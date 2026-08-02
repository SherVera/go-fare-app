export interface Bank {
  code: string;
  name: string;
  shortName: string;
}

export const VENEZUELAN_BANKS: Bank[] = [
  { code: '0102', name: 'Banco de Venezuela', shortName: 'BDV' },
  { code: '0104', name: 'Venezolano de Crédito', shortName: 'BVC' },
  { code: '0105', name: 'Banco Mercantil', shortName: 'Mercantil' },
  { code: '0108', name: 'BBVA Provincial', shortName: 'Provincial' },
  {
    code: '0114',
    name: 'Bancamiga Banco Microfinanciero',
    shortName: 'Bancamiga',
  },
  { code: '0115', name: 'Banco Exterior', shortName: 'Exterior' },
  { code: '0128', name: 'Banco Caroní', shortName: 'Caroní' },
  { code: '0134', name: 'Banesco Banco Universal', shortName: 'Banesco' },
  { code: '0137', name: 'Banco Sofitasa', shortName: 'Sofitasa' },
  { code: '0138', name: 'Banco Plaza', shortName: 'Plaza' },
  { code: '0151', name: 'Banco Nacional de Crédito (BNC)', shortName: 'BNC' },
  { code: '0156', name: '100% Banco', shortName: '100% Banco' },
  { code: '0157', name: 'DelSur Banco Universal', shortName: 'DelSur' },
  { code: '0163', name: 'Banco del Tesoro', shortName: 'Tesoro' },
  { code: '0166', name: 'Banco Agrícola de Venezuela', shortName: 'Agrícola' },
  { code: '0168', name: 'Bancrecer', shortName: 'Bancrecer' },
  { code: '0169', name: 'Mi Banco', shortName: 'Mi Banco' },
  { code: '0171', name: 'Banco Activo', shortName: 'Activo' },
  { code: '0174', name: 'Banplus Banco Universal', shortName: 'Banplus' },
  {
    code: '0175',
    name: 'Banco Bicentenario del Pueblo',
    shortName: 'Bicentenario',
  },
  { code: '0177', name: 'BANFANB', shortName: 'BANFANB' },
  { code: '0191', name: 'N58 Banco Digital', shortName: 'N58' },
];
