export interface BankOption {
  id: string;
  name: string;
  domain: string;
  brandColor: string;
  customLogoUrl?: string;
}

export const POPULAR_BANKS: BankOption[] = [
  { id: 'nubank', name: 'Nubank', domain: 'nubank.com.br', brandColor: '#8B5CF6' },
  { id: 'itau', name: 'Itaú', domain: 'itau.com.br', brandColor: '#F97316' },
  { id: 'bb', name: 'Banco do Brasil', domain: 'bb.com.br', brandColor: '#EAB308' },
  { id: 'bradesco', name: 'Bradesco', domain: 'bradesco.com.br', brandColor: '#F43F5E' },
  { id: 'santander', name: 'Santander', domain: 'santander.com.br', brandColor: '#EF4444' },
  // O domínio oficial atual do Banco Inter é inter.co (bancointer.com.br não retornava o ícone no Icon.Horse)
  { id: 'inter', name: 'Banco Inter', domain: 'inter.co', brandColor: '#EA580C' },
  { id: 'c6', name: 'C6 Bank', domain: 'c6bank.com.br', brandColor: '#94A3B8' },
  { 
    id: 'caixa', 
    name: 'Caixa Econômica', 
    domain: 'caixa.gov.br',
    brandColor: '#3B82F6',
    customLogoUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="15" fill="%23005CA9"/><path d="M 25 25 L 75 75 M 25 75 L 75 25" stroke="%23FFF" stroke-width="16" stroke-linecap="square"/><path d="M 46 25 L 75 54 M 25 46 L 54 75" stroke="%23F39200" stroke-width="6" stroke-linecap="square"/></svg>'
  },
  { id: 'btg', name: 'BTG Pactual', domain: 'btgpactual.com', brandColor: '#3B82F6' },
  { id: 'xpi', name: 'XP Investimentos', domain: 'xpi.com.br', brandColor: '#EAB308' },
  { 
    id: 'sicredi', 
    name: 'Sicredi', 
    domain: 'sicredi.com.br',
    brandColor: '#10B981',
    customLogoUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="15" fill="%23008A4A"/><path d="M 50 50 L 25 25 A 35 35 0 0 1 50 15 Z M 50 50 L 75 25 A 35 35 0 0 1 85 50 Z M 50 50 L 75 75 A 35 35 0 0 1 50 85 Z M 50 50 L 25 75 A 35 35 0 0 1 15 50 Z" fill="%23FFF"/></svg>' 
  },
  { id: 'sicoob', name: 'Sicoob', domain: 'sicoob.com.br', brandColor: '#14B8A6' },
  { id: 'mercado_pago', name: 'Mercado Pago', domain: 'mercadopago.com.br', brandColor: '#38BDF8' },
  { id: 'picpay', name: 'PicPay', domain: 'picpay.com', brandColor: '#10B981' },
  { id: 'pagbank', name: 'PagBank', domain: 'pagbank.com.br', brandColor: '#22C55E' },
  { id: 'outros', name: 'Outro Banco', domain: 'finance.yahoo.com', brandColor: '#6366F1' }
];

export function findBankFromText(text: string): BankOption | null {
  if (!text) return null;
  const lower = text.trim().toLowerCase();
  const exact = POPULAR_BANKS.find(b => b.name.toLowerCase() === lower);
  if (exact) return exact;
  return POPULAR_BANKS.find(b =>
    lower.includes(b.name.toLowerCase()) ||
    lower.includes(b.id) ||
    (b.id === 'inter' && lower.includes('inter')) ||
    (b.id === 'itau' && (lower.includes('itau') || lower.includes('itaú')))
  ) || null;
}

export function getBankDomainByName(bankName: string): string | null {
  const bank = findBankFromText(bankName);
  return bank ? bank.domain : null;
}

export function getBankLogoUrl(bankName: string): string | null {
  if (!bankName) return null;
  const bank = findBankFromText(bankName);
  if (!bank) return null;

  if (bank.customLogoUrl) {
    return bank.customLogoUrl;
  }
  return `https://icon.horse/icon/${bank.domain}`;
}

export function getBankBrandColor(text: string): string {
  const bank = findBankFromText(text);
  if (bank) return bank.brandColor;
  return '#6366F1';
}
