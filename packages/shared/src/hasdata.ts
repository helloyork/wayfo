export type HasDataRequestMetadata = {
  id: string;
  status: string;
  html?: string;
  json?: string;
  url?: string;
};

export type HasDataPrice = {
  symbol?: string;
  currentPrice?: number;
  beforePrice?: number;
  discount?: string;
  priceFrom?: number;
  otherOfferQuantity?: number;
};

export type HasDataBadges = {
  amazonChoice?: boolean;
  amazonExclusive?: boolean;
  amazonPrime?: boolean;
  bestSeller?: boolean;
  limitedTimeDeal?: boolean;
};

export type HasDataVariant = {
  asin?: string;
  title?: string;
  url?: string;
  imageUrl?: string;
};

export type HasDataSpecificationEntry = {
  key?: string;
  value?: string;
};

export type HasDataReviewAspect = {
  aspect?: string;
  count?: number;
  status?: string;
};

export type HasDataReview = {
  reviewTitle?: string;
  reviewText?: string;
  reviewDate?: string;
  customer?: string;
  customerProfileUrl?: string;
  customerStarsRating?: number;
  helpfulVotes?: string;
  productSpecs?: Record<string, string>;
};

export type HasDataReviewsInfo = {
  totalReviews?: number;
  rating?: number;
  starRates?: Record<string, string>;
  customersSay?: string;
  aspects?: HasDataReviewAspect[];
  customersImageUrls?: string[];
  reviews?: HasDataReview[];
};

export type HasDataProduct = {
  asin?: string;
  url?: string;
  title?: string;
  brand?: string;
  isAvailable?: boolean;
  primaryFeatures?: Record<string, string>;
  features?: Record<string, string>;
  featureBullets?: string[];
  boughtInPastMonth?: string;
  badges?: HasDataBadges;
  breadcrumbs?: string[];
  variants?: HasDataVariant[];
  price?: HasDataPrice;
  deliveryRawDate?: string;
  deliveryIsoDate?: string;
  returns?: string;
  seller?: string;
  sellerUrl?: string;
  shipper?: string;
  totalImages?: number;
  primaryImage?: string;
  images?: string[];
  descriptionImages?: string[];
  totalVideos?: number;
  primaryVideo?: string;
  videos?: string[];
  specification?: HasDataSpecificationEntry[];
  reviewsInfo?: HasDataReviewsInfo;
};

export type HasDataAmazonProductResponse = {
  requestMetadata?: HasDataRequestMetadata;
  product?: HasDataProduct;
};
