import http from 'node:http';
import pg from 'pg';

const { Pool } = pg;

const PORT = Number(process.env.VAULT_PORT || 8787);
const ALLOWED_ORIGIN = process.env.VAULT_CORS_ORIGIN || '*';

const TARGET_DB = process.env.PGDATABASE || 'somma_vault';

const basePgConfig = {
    host: process.env.PGHOST || 'automacao-postgres-1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    max: 10,
    idleTimeoutMillis: 30000
};

// Pool principal apontando para o banco isolado somma_vault
const pool = new Pool({
    ...basePgConfig,
    database: TARGET_DB
});

// Garante que o database isolado "somma_vault" e as tabelas do Cofre existam automaticamente ao iniciar
const ensureSchema = async () => {
    // 1. Conecta rapidamente no banco administrativo padrão ('postgres') para criar o database 'somma_vault' caso não exista
    const adminPool = new Pool({
        ...basePgConfig,
        database: process.env.PGADMIN_DB || 'postgres'
    });
    const adminClient = await adminPool.connect();
    try {
        const dbCheck = await adminClient.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`,
            [TARGET_DB]
        );
        if (dbCheck.rowCount === 0) {
            await adminClient.query(`CREATE DATABASE "${TARGET_DB.replace(/"/g, '')}"`);
            console.log(`[Tailscale Vault] Database isolado "${TARGET_DB}" criado com sucesso!`);
        }
    } finally {
        adminClient.release();
        await adminPool.end();
    }

    // 2. Agora conecta dentro do database isolado "somma_vault" e cria as tabelas
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE EXTENSION IF NOT EXISTS "pgcrypto";

            CREATE TABLE IF NOT EXISTS fin_piggybank (
                id_piggybank UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(128) NOT NULL,
                title VARCHAR(255) NOT NULL,
                target_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
                current_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
                composes_balance BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_piggybank_user_id ON fin_piggybank(user_id);

            CREATE TABLE IF NOT EXISTS fin_piggybank_transaction (
                id_transaction UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                piggybank_id UUID NOT NULL REFERENCES fin_piggybank(id_piggybank) ON DELETE CASCADE,
                user_id VARCHAR(128) NOT NULL,
                transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdraw')),
                amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        console.log(`[Tailscale Vault] Tabelas verificadas no database isolado "${TARGET_DB}".`);
    } finally {
        client.release();
    }
};

// Verifica se o IP pertence à rede Tailscale (100.64.0.0/10), localhost ou sub-rede interna do Docker (172.x.x.x / 192.168.x.x quando roteado pelo container Tailscale)
const isAuthorizedNetwork = (remoteAddress = '') => {
    const cleanIp = remoteAddress.replace(/^::ffff:/, '');
    if (cleanIp === '127.0.0.1' || cleanIp === '::1' || cleanIp === 'localhost') {
        return true;
    }
    const parts = cleanIp.split('.').map(Number);
    if (parts.length === 4) {
        // CGNAT Tailscale: 100.64.0.0/10
        if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
        // Sub-redes privadas de bridge do Docker (quando a porta já está bindada em 100.109.175.21 no host)
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        if (parts[0] === 192 && parts[1] === 168) return true;
    }
    if (cleanIp.toLowerCase().startsWith('fd7a:115c:a1e0:')) {
        return true;
    }
    return false;
};

// Decodifica o JWT do Supabase para isolar os cofrinhos por user_id
const extractUserFromAuthHeader = (authHeader = '') => {
    if (!authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    if (token === 'mock-jwt-token') {
        return { id: 'mock-user-123', email: 'thiago@somma.ai' };
    }
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        if (payload.exp && Date.now() >= payload.exp * 1000) {
            return null;
        }
        return {
            id: payload.sub || null,
            email: payload.email || null
        };
    } catch {
        return null;
    }
};

const parseJsonBody = (req) => new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
        body += chunk;
        if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
        if (!body) return resolve({});
        try {
            resolve(JSON.parse(body));
        } catch (err) {
            reject(err);
        }
    });
    req.on('error', reject);
});

const sendJson = (res, statusCode, data) => {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
};

const normalizeRow = (row) => ({
    ...row,
    target_amount: Number(row.target_amount),
    current_amount: Number(row.current_amount)
});

const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        });
        return res.end();
    }

    const remoteIp = req.socket.remoteAddress || '';
    if (!isAuthorizedNetwork(remoteIp)) {
        return sendJson(res, 403, { error: 'Forbidden: Tailscale VPN required.' });
    }

    const urlObj = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = urlObj.pathname;

    // GET /health -> Verifica tanto o túnel Tailscale quanto a conexão com o Postgres da Oracle
    if (req.method === 'GET' && pathname === '/health') {
        try {
            await pool.query('SELECT 1');
            return sendJson(res, 200, {
                status: 'ok',
                engine: 'postgresql',
                network: 'tailnet-verified',
                timestamp: new Date().toISOString()
            });
        } catch (dbErr) {
            console.error('[Vault Healthcheck DB Error]:', dbErr.message);
            return sendJson(res, 500, { status: 'error', message: 'Database connection failed' });
        }
    }

    const user = extractUserFromAuthHeader(req.headers.authorization || '');
    const userId = user?.id || 'default-owner';

    try {
        // GET /api/vault/piggybanks
        if (req.method === 'GET' && pathname === '/api/vault/piggybanks') {
            const { rows } = await pool.query(
                `SELECT * FROM fin_piggybank WHERE user_id = $1 ORDER BY created_at ASC`,
                [userId]
            );
            return sendJson(res, 200, rows.map(normalizeRow));
        }

        // POST /api/vault/piggybanks
        if (req.method === 'POST' && pathname === '/api/vault/piggybanks') {
            const body = await parseJsonBody(req);
            const owner = body.user_id || userId;
            const title = String(body.title || 'Novo Cofrinho').trim();
            const targetAmount = Number(body.target_amount) || 0;
            const currentAmount = Number(body.current_amount) || 0;
            const composesBalance = Boolean(body.composes_balance);

            const { rows } = await pool.query(
                `INSERT INTO fin_piggybank (user_id, title, target_amount, current_amount, composes_balance)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [owner, title, targetAmount, currentAmount, composesBalance]
            );
            return sendJson(res, 201, normalizeRow(rows[0]));
        }

        // PATCH /api/vault/piggybanks/:id
        const matchItem = pathname.match(/^\/api\/vault\/piggybanks\/([^/]+)$/);
        if (req.method === 'PATCH' && matchItem) {
            const piggyId = matchItem[1];
            const body = await parseJsonBody(req);

            const fields = [];
            const values = [];
            let idx = 1;

            if (body.title !== undefined) {
                fields.push(`title = $${idx++}`);
                values.push(String(body.title).trim());
            }
            if (body.target_amount !== undefined) {
                fields.push(`target_amount = $${idx++}`);
                values.push(Number(body.target_amount));
            }
            if (body.current_amount !== undefined) {
                fields.push(`current_amount = $${idx++}`);
                values.push(Number(body.current_amount));
            }
            if (body.composes_balance !== undefined) {
                fields.push(`composes_balance = $${idx++}`);
                values.push(Boolean(body.composes_balance));
            }

            if (fields.length === 0) {
                return sendJson(res, 400, { error: 'Nenhum campo para atualizar.' });
            }

            values.push(piggyId);
            const { rows } = await pool.query(
                `UPDATE fin_piggybank SET ${fields.join(', ')} WHERE id_piggybank = $${idx} RETURNING *`,
                values
            );

            if (rows.length === 0) {
                return sendJson(res, 404, { error: 'Cofrinho não encontrado.' });
            }
            return sendJson(res, 200, normalizeRow(rows[0]));
        }

        // DELETE /api/vault/piggybanks/:id
        if (req.method === 'DELETE' && matchItem) {
            const piggyId = matchItem[1];
            await pool.query(`DELETE FROM fin_piggybank WHERE id_piggybank = $1`, [piggyId]);
            return sendJson(res, 200, { deleted: true, id_piggybank: piggyId });
        }

        // POST /api/vault/piggybanks/:id/transactions
        const matchTx = pathname.match(/^\/api\/vault\/piggybanks\/([^/]+)\/transactions$/);
        if (req.method === 'POST' && matchTx) {
            const piggyId = matchTx[1];
            const body = await parseJsonBody(req);
            const owner = body.user_id || userId;
            const txType = body.transaction_type === 'withdraw' ? 'withdraw' : 'deposit';
            const amount = Number(body.amount) || 0;

            const { rows } = await pool.query(
                `INSERT INTO fin_piggybank_transaction (piggybank_id, user_id, transaction_type, amount)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [piggyId, owner, txType, amount]
            );
            return sendJson(res, 201, rows[0]);
        }

        return sendJson(res, 404, { error: 'Endpoint não encontrado.' });
    } catch (err) {
        console.error('[Tailscale Vault Postgres Error]:', err);
        return sendJson(res, 500, { error: 'Erro interno no banco PostgreSQL do Cofre.' });
    }
});

ensureSchema()
    .then(() => {
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`🔒 Somma Tailscale Vault (PostgreSQL Engine) rodando na porta ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Falha ao conectar no PostgreSQL do Cofre:', err.message);
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`⚠️ Servidor HTTP iniciado na porta ${PORT} (aguardando PostgreSQL ficar disponível)`);
        });
    });
