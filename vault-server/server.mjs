import http from 'node:http';
import crypto from 'node:crypto';
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
                bank_name VARCHAR(100),
                product_type VARCHAR(80),
                indexer VARCHAR(40),
                rate_value NUMERIC(10, 2),
                liquidity VARCHAR(40),
                maturity_date DATE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            ALTER TABLE fin_piggybank ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
            ALTER TABLE fin_piggybank ADD COLUMN IF NOT EXISTS product_type VARCHAR(80);
            ALTER TABLE fin_piggybank ADD COLUMN IF NOT EXISTS indexer VARCHAR(40);
            ALTER TABLE fin_piggybank ADD COLUMN IF NOT EXISTS rate_value NUMERIC(10, 2);
            ALTER TABLE fin_piggybank ADD COLUMN IF NOT EXISTS liquidity VARCHAR(40);
            ALTER TABLE fin_piggybank ADD COLUMN IF NOT EXISTS maturity_date DATE;
            ALTER TABLE fin_piggybank ADD COLUMN IF NOT EXISTS last_yield_date DATE;
            ALTER TABLE fin_piggybank ADD COLUMN IF NOT EXISTS total_yield_earned NUMERIC(15, 2) NOT NULL DEFAULT 0;
            ALTER TABLE fin_piggybank ADD COLUMN IF NOT EXISTS effective_tax_rate NUMERIC(6, 2);

            CREATE INDEX IF NOT EXISTS idx_piggybank_user_id ON fin_piggybank(user_id);

            CREATE TABLE IF NOT EXISTS fin_piggybank_transaction (
                id_transaction UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                piggybank_id UUID NOT NULL REFERENCES fin_piggybank(id_piggybank) ON DELETE CASCADE,
                user_id VARCHAR(128) NOT NULL,
                transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('deposit', 'withdraw')),
                amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS fin_variable_asset (
                id_asset UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id VARCHAR(128) NOT NULL,
                ticker VARCHAR(32) NOT NULL,
                name VARCHAR(120),
                asset_class VARCHAR(30) NOT NULL DEFAULT 'ACAO',
                broker VARCHAR(80),
                quantity NUMERIC(20, 8) NOT NULL DEFAULT 0,
                average_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
                current_price NUMERIC(18, 4) NOT NULL DEFAULT 0,
                currency VARCHAR(10) NOT NULL DEFAULT 'BRL',
                last_dividend_per_share NUMERIC(18, 6),
                last_dividend_date DATE,
                staking_apy NUMERIC(8, 2),
                last_price_sync TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            ALTER TABLE fin_variable_asset ADD COLUMN IF NOT EXISTS last_dividend_per_share NUMERIC(18, 6);
            ALTER TABLE fin_variable_asset ADD COLUMN IF NOT EXISTS last_dividend_date DATE;
            ALTER TABLE fin_variable_asset ADD COLUMN IF NOT EXISTS staking_apy NUMERIC(8, 2);

            CREATE INDEX IF NOT EXISTS idx_variable_asset_user_id ON fin_variable_asset(user_id);
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
        // Sub-redes privadas de bridge do Docker (quando a porta já está bindada exclusivamente na interface Tailscale do host)
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        if (parts[0] === 192 && parts[1] === 168) return true;
    }
    if (cleanIp.toLowerCase().startsWith('fd7a:115c:a1e0:')) {
        return true;
    }
    return false;
};

// Decodifica e valida o JWT do Supabase para isolar os cofrinhos por user_id (Zero-Trust)
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

const extractUserFromAuthHeader = (authHeader = '') => {
    if (!authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    if (!token) return null;

    if (token === 'mock-jwt-token' && process.env.ALLOW_MOCK_AUTH === 'true') {
        return { id: 'mock-user-123', email: 'thiago@somma.ai' };
    }

    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
        // Se SUPABASE_JWT_SECRET estiver configurado no container, valida assinatura HMAC-SHA256 criptograficamente
        if (SUPABASE_JWT_SECRET) {
            const signingInput = `${parts[0]}.${parts[1]}`;
            const expectedSig = crypto
                .createHmac('sha256', SUPABASE_JWT_SECRET)
                .update(signingInput)
                .digest('base64url');
            if (expectedSig !== parts[2]) {
                return null;
            }
        }

        const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        if (!payload || typeof payload.sub !== 'string' || !payload.sub.trim()) {
            return null;
        }
        if (payload.exp && Date.now() >= payload.exp * 1000) {
            return null;
        }
        if (payload.role !== 'authenticated' && payload.aud !== 'authenticated') {
            return null;
        }
        return {
            id: payload.sub,
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

const normalizeAssetRow = (row) => ({
    ...row,
    quantity: Number(row.quantity),
    average_price: Number(row.average_price),
    current_price: Number(row.current_price),
    last_dividend_per_share: row.last_dividend_per_share !== null && row.last_dividend_per_share !== undefined ? Number(row.last_dividend_per_share) : null,
    staking_apy: row.staking_apy !== null && row.staking_apy !== undefined ? Number(row.staking_apy) : null
});

// Busca cotação ao vivo e último dividendo pago (B3 via Yahoo Finance .SA com events=div; Cripto via Binance BRL)
// Nenhum dado pessoal ou quantidade do usuário é enviado — apenas o código público do ativo.
const fetchLiveQuote = async (rawTicker = '', assetClass = 'ACAO') => {
    const ticker = String(rawTicker).trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '');
    if (!ticker) return null;

    if (assetClass === 'CRIPTO') {
        try {
            const pair = ticker.endsWith('BRL') ? ticker : `${ticker}BRL`;
            const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
            if (res.ok) {
                const data = await res.json();
                const price = parseFloat(data?.price);
                if (!Number.isNaN(price) && price > 0) {
                    return { ticker, price, source: 'binance-brl', currency: 'BRL', last_dividend_per_share: null, last_dividend_date: null };
                }
            }
        } catch {
            // fallback abaixo
        }
        return null;
    }

    // Ações B3, FIIs, ETFs e BDRs -> Yahoo Finance (.SA) com histórico de dividendos dos últimos 6 meses
    const yahooSymbol = ticker.includes('.') ? ticker : `${ticker}.SA`;
    try {
        const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=6mo&events=div`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        if (res.ok) {
            const data = await res.json();
            const result = data?.chart?.result?.[0];
            const meta = result?.meta;
            const price = Number(meta?.regularMarketPrice || meta?.chartPreviousClose || 0);

            let lastDivAmount = null;
            let lastDivDate = null;
            const divMap = result?.events?.dividends;
            if (divMap && typeof divMap === 'object') {
                const divList = Object.values(divMap).sort((a, b) => Number(b.date || 0) - Number(a.date || 0));
                if (divList.length > 0 && Number(divList[0].amount) > 0) {
                    lastDivAmount = Math.round(Number(divList[0].amount) * 1000000) / 1000000;
                    lastDivDate = new Date(Number(divList[0].date) * 1000).toISOString().slice(0, 10);
                }
            }

            if (price > 0) {
                return {
                    ticker,
                    price: Math.round(price * 10000) / 10000,
                    name: meta?.shortName || meta?.longName || null,
                    last_dividend_per_share: lastDivAmount,
                    last_dividend_date: lastDivDate,
                    source: 'yahoo-b3',
                    currency: meta?.currency || 'BRL'
                };
            }
        }
    } catch {
        // ignora erro de rede
    }
    return null;
};

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

    // Blindagem A: Exige obrigatoriamente um JWT válido de usuário autenticado em todas as rotas /api/vault/*
    const user = extractUserFromAuthHeader(req.headers.authorization || '');
    if (!user?.id) {
        return sendJson(res, 401, {
            error: 'Unauthorized: Token de sessão Supabase válido é obrigatório para acessar o Cofre Tailscale.'
        });
    }
    const userId = user.id;

    try {
        // GET /api/vault/piggybanks
        if (req.method === 'GET' && pathname === '/api/vault/piggybanks') {
            // Migra automaticamente registros antigos que tenham ficado com 'default-owner' para o userId autenticado
            await pool.query(
                `UPDATE fin_piggybank SET user_id = $1 WHERE user_id = 'default-owner'`,
                [userId]
            );
            const { rows } = await pool.query(
                `SELECT * FROM fin_piggybank WHERE user_id = $1 ORDER BY created_at ASC`,
                [userId]
            );
            return sendJson(res, 200, rows.map(normalizeRow));
        }

        // POST /api/vault/piggybanks
        if (req.method === 'POST' && pathname === '/api/vault/piggybanks') {
            const body = await parseJsonBody(req);
            const owner = userId; // Blindagem B: Ignora user_id enviado no body e usa sempre o sub do JWT autenticado
            const title = String(body.title || 'Nova Conta').trim();
            const targetAmount = Number(body.target_amount) || 0;
            const currentAmount = Number(body.current_amount) || 0;
            const composesBalance = Boolean(body.composes_balance);
            const bankName = body.bank_name || null;
            const productType = body.product_type || null;
            const indexer = body.indexer || null;
            const rateValue = body.rate_value !== undefined ? Number(body.rate_value) : null;
            const liquidity = body.liquidity || null;
            const maturityDate = body.maturity_date || null;
            const effectiveTaxRate = body.effective_tax_rate !== undefined && body.effective_tax_rate !== null
                ? Number(body.effective_tax_rate)
                : null;

            const { rows } = await pool.query(
                `INSERT INTO fin_piggybank (
                    user_id, title, target_amount, current_amount, composes_balance,
                    bank_name, product_type, indexer, rate_value, liquidity, maturity_date, effective_tax_rate
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 RETURNING *`,
                [owner, title, targetAmount, currentAmount, composesBalance, bankName, productType, indexer, rateValue, liquidity, maturityDate, effectiveTaxRate]
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
            if (body.bank_name !== undefined) {
                fields.push(`bank_name = $${idx++}`);
                values.push(body.bank_name || null);
            }
            if (body.product_type !== undefined) {
                fields.push(`product_type = $${idx++}`);
                values.push(body.product_type || null);
            }
            if (body.indexer !== undefined) {
                fields.push(`indexer = $${idx++}`);
                values.push(body.indexer || null);
            }
            if (body.rate_value !== undefined) {
                fields.push(`rate_value = $${idx++}`);
                values.push(Number(body.rate_value));
            }
            if (body.liquidity !== undefined) {
                fields.push(`liquidity = $${idx++}`);
                values.push(body.liquidity || null);
            }
            if (body.maturity_date !== undefined) {
                fields.push(`maturity_date = $${idx++}`);
                values.push(body.maturity_date || null);
            }
            if (body.last_yield_date !== undefined) {
                fields.push(`last_yield_date = $${idx++}`);
                values.push(body.last_yield_date || null);
            }
            if (body.total_yield_earned !== undefined) {
                fields.push(`total_yield_earned = $${idx++}`);
                values.push(Number(body.total_yield_earned) || 0);
            }
            if (body.effective_tax_rate !== undefined) {
                fields.push(`effective_tax_rate = $${idx++}`);
                values.push(body.effective_tax_rate !== null ? Number(body.effective_tax_rate) : null);
            }

            if (fields.length === 0) {
                return sendJson(res, 400, { error: 'Nenhum campo para atualizar.' });
            }

            values.push(piggyId);
            const idParamIdx = idx++;
            values.push(userId);
            const userParamIdx = idx++;

            // Blindagem B: Filtra por id_piggybank E user_id autenticado
            const { rows } = await pool.query(
                `UPDATE fin_piggybank SET ${fields.join(', ')} WHERE id_piggybank = $${idParamIdx} AND user_id = $${userParamIdx} RETURNING *`,
                values
            );

            if (rows.length === 0) {
                return sendJson(res, 404, { error: 'Cofrinho não encontrado ou acesso negado.' });
            }
            return sendJson(res, 200, normalizeRow(rows[0]));
        }

        // DELETE /api/vault/piggybanks/:id
        if (req.method === 'DELETE' && matchItem) {
            const piggyId = matchItem[1];
            const result = await pool.query(
                `DELETE FROM fin_piggybank WHERE id_piggybank = $1 AND user_id = $2`,
                [piggyId, userId]
            );
            if (result.rowCount === 0) {
                return sendJson(res, 404, { error: 'Cofrinho não encontrado ou acesso negado.' });
            }
            return sendJson(res, 200, { deleted: true, id_piggybank: piggyId });
        }

        // POST /api/vault/piggybanks/:id/transactions
        const matchTx = pathname.match(/^\/api\/vault\/piggybanks\/([^/]+)\/transactions$/);
        if (req.method === 'POST' && matchTx) {
            const piggyId = matchTx[1];
            const body = await parseJsonBody(req);
            const txType = body.transaction_type === 'withdraw' ? 'withdraw' : 'deposit';
            const amount = Number(body.amount) || 0;

            // Garante que a caixinha pertence ao usuário autenticado antes de gravar a transação
            const checkOwner = await pool.query(
                `SELECT 1 FROM fin_piggybank WHERE id_piggybank = $1 AND user_id = $2`,
                [piggyId, userId]
            );
            if (checkOwner.rowCount === 0) {
                return sendJson(res, 403, { error: 'Acesso negado a esta conta/caixinha.' });
            }

            const { rows } = await pool.query(
                `INSERT INTO fin_piggybank_transaction (piggybank_id, user_id, transaction_type, amount)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [piggyId, userId, txType, amount]
            );
            return sendJson(res, 201, rows[0]);
        }

        // === ROTAS DE RENDA VARIÁVEL & CRIPTO (ZERO-TRUST) ===

        // GET /api/vault/quote?ticker=PETR4&asset_class=ACAO
        if (req.method === 'GET' && pathname === '/api/vault/quote') {
            const ticker = urlObj.searchParams.get('ticker') || '';
            const assetClass = urlObj.searchParams.get('asset_class') || 'ACAO';
            const quote = await fetchLiveQuote(ticker, assetClass);
            if (!quote) {
                return sendJson(res, 404, { error: `Cotação não encontrada para ${ticker}.` });
            }
            return sendJson(res, 200, quote);
        }

        // GET /api/vault/assets
        if (req.method === 'GET' && pathname === '/api/vault/assets') {
            const { rows } = await pool.query(
                `SELECT * FROM fin_variable_asset WHERE user_id = $1 ORDER BY asset_class ASC, ticker ASC`,
                [userId]
            );
            return sendJson(res, 200, rows.map(normalizeAssetRow));
        }

        // POST /api/vault/assets
        if (req.method === 'POST' && pathname === '/api/vault/assets') {
            const body = await parseJsonBody(req);
            const ticker = String(body.ticker || '').trim().toUpperCase();
            if (!ticker) return sendJson(res, 400, { error: 'Ticker é obrigatório.' });

            const name = body.name ? String(body.name).trim() : null;
            const assetClass = String(body.asset_class || 'ACAO').toUpperCase();
            const broker = body.broker ? String(body.broker).trim() : null;
            const quantity = Number(body.quantity) || 0;
            const averagePrice = Number(body.average_price) || 0;
            const currentPrice = Number(body.current_price) || averagePrice;
            const currency = String(body.currency || 'BRL').toUpperCase();
            const lastDivPerShare = body.last_dividend_per_share !== undefined && body.last_dividend_per_share !== null
                ? Number(body.last_dividend_per_share)
                : null;
            const lastDivDate = body.last_dividend_date || null;
            const stakingApy = body.staking_apy !== undefined && body.staking_apy !== null
                ? Number(body.staking_apy)
                : null;

            const { rows } = await pool.query(
                `INSERT INTO fin_variable_asset (
                    user_id, ticker, name, asset_class, broker, quantity, average_price, current_price, currency,
                    last_dividend_per_share, last_dividend_date, staking_apy, last_price_sync
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                 RETURNING *`,
                [userId, ticker, name, assetClass, broker, quantity, averagePrice, currentPrice, currency, lastDivPerShare, lastDivDate, stakingApy]
            );
            return sendJson(res, 201, normalizeAssetRow(rows[0]));
        }

        // PATCH /api/vault/assets/:id
        const matchAsset = pathname.match(/^\/api\/vault\/assets\/([^/]+)$/);
        if (req.method === 'PATCH' && matchAsset) {
            const assetId = matchAsset[1];
            const body = await parseJsonBody(req);
            const fields = [];
            const values = [];
            let idx = 1;

            if (body.ticker !== undefined) {
                fields.push(`ticker = $${idx++}`);
                values.push(String(body.ticker).trim().toUpperCase());
            }
            if (body.name !== undefined) {
                fields.push(`name = $${idx++}`);
                values.push(body.name ? String(body.name).trim() : null);
            }
            if (body.asset_class !== undefined) {
                fields.push(`asset_class = $${idx++}`);
                values.push(String(body.asset_class).toUpperCase());
            }
            if (body.broker !== undefined) {
                fields.push(`broker = $${idx++}`);
                values.push(body.broker ? String(body.broker).trim() : null);
            }
            if (body.quantity !== undefined) {
                fields.push(`quantity = $${idx++}`);
                values.push(Number(body.quantity) || 0);
            }
            if (body.average_price !== undefined) {
                fields.push(`average_price = $${idx++}`);
                values.push(Number(body.average_price) || 0);
            }
            if (body.current_price !== undefined) {
                fields.push(`current_price = $${idx++}`);
                values.push(Number(body.current_price) || 0);
                fields.push(`last_price_sync = NOW()`);
            }
            if (body.last_dividend_per_share !== undefined) {
                fields.push(`last_dividend_per_share = $${idx++}`);
                values.push(body.last_dividend_per_share !== null ? Number(body.last_dividend_per_share) : null);
            }
            if (body.last_dividend_date !== undefined) {
                fields.push(`last_dividend_date = $${idx++}`);
                values.push(body.last_dividend_date || null);
            }
            if (body.staking_apy !== undefined) {
                fields.push(`staking_apy = $${idx++}`);
                values.push(body.staking_apy !== null ? Number(body.staking_apy) : null);
            }

            if (fields.length === 0) {
                return sendJson(res, 400, { error: 'Nenhum campo para atualizar.' });
            }

            values.push(assetId);
            const idIdx = idx++;
            values.push(userId);
            const userIdx = idx++;

            const { rows } = await pool.query(
                `UPDATE fin_variable_asset SET ${fields.join(', ')} WHERE id_asset = $${idIdx} AND user_id = $${userIdx} RETURNING *`,
                values
            );
            if (rows.length === 0) {
                return sendJson(res, 404, { error: 'Ativo não encontrado ou acesso negado.' });
            }
            return sendJson(res, 200, normalizeAssetRow(rows[0]));
        }

        // DELETE /api/vault/assets/:id
        if (req.method === 'DELETE' && matchAsset) {
            const assetId = matchAsset[1];
            const result = await pool.query(
                `DELETE FROM fin_variable_asset WHERE id_asset = $1 AND user_id = $2`,
                [assetId, userId]
            );
            if (result.rowCount === 0) {
                return sendJson(res, 404, { error: 'Ativo não encontrado ou acesso negado.' });
            }
            return sendJson(res, 200, { deleted: true, id_asset: assetId });
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
