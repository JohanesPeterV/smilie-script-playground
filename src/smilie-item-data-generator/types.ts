export type StockRow = {
  itemCode: string;
  description: string;
  quantity: number;
  price: number;
};

export type ProductMarketingContent = {
  seoTitle: string;
  productTitle: string;
  productDescription: string;
  longProductDescription: string;
  metaDescription: string;
};

export type ProductStockResult = {
  code: string;
  imageUrl?: string;
  results: StockRow[];
  marketingContent?: ProductMarketingContent | null;
  myGift?: MyGiftProductDetails | null;
  images?: string[];
  parentCat?: string;
  subCat?: string;
};

export type MyGiftProductDetails = {
  code: string;
  name?: string;
  url?: string;
  material?: string;
  dimension?: string;
  weight?: string;
  finished?: string;
  function?: string;
  printingMethods?: string[];
  images: string[];
};

export type Product = {
  code: string;
  parentCat?: string;
  subCat?: string;
};
