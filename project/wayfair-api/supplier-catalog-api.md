Supplier Catalog API
Allows Wayfair suppliers to manage their respective catalogs.

API Endpoints
# Production Server:
https://api.wayfair.io/v1/supplier-catalog-api/graphql
# Sandbox Server:
https://api.wayfair.io/sandbox/v1/supplier-catalog-api/graphql
Headers
# Your Bearer token with the scope `read:catalog_products`
Authorization: Bearer <YOUR_TOKEN_HERE>
Queries
Queries
supplierCatalog
Description
Provides a paginated list of products for a given supplier with pagination metadata.

Response
Returns a SupplierCatalog

Arguments
Name	Description
supplierId - Int!	The id of the supplier to get the catalog for.
filter - ProductFilter	The product filter to apply to the products
paginationOptions - PaginationOptions	Pagination options to be used for this query.
Example
Query
query GetSupplierCatalog(
  $supplierId: Int!,
  $filter: ProductFilter,
  $paginationOptions: PaginationOptions
) {
  supplierCatalog(
    supplierId: $supplierId,
    filter: $filter,
    paginationOptions: $paginationOptions
  ) {
    supplierId
    pageInfo {
      page
      pageSize
      hasNextPage
      totalPages
    }
    products {
      productId
      upc
      supplierPartNumber
      status
      skus {
        productDescriptions {
          descriptions {
            descriptionId
            descriptionType
            rank
            value
            isActive
          }
        }
        isLive
        sku
        collectionName
        displaySku
        productName
        className
        classId
        retailPrice {
          unit {
            amount
            currency
          }
          item {
            amount
            currency
          }
        }
        urls
        isWhiteLabeled
        status
        productDimensions {
          lengthUnit
          depth
          height
          width
          weightUnit
          weight
        }
        productDetails {
          questionId
          title
          value
          description
          childProductDetails {
            questionId
            title
            description
            value
          }
        }
        minimumOrderQuantity
        displaySetQuantity
        forceMultiple
        primaryImage {
          id
          url
        }
        eligiblePrimaryImages
        manufacturer {
          brandType
          id
          isWhiteLabel
          name
        }
      }
      images {
        id
        url
      }
      videos {
        id
        url
      }
      documents {
        id
        url
      }
      manufacturerPart {
        partId
        partNumber
      }
      mediaAssociationRequests {
        mediaId
        mediaType
        requestType
        status
      }
      optionCombos
    }
  }
}
Variables
{
  "supplierId": 23403,
  "filter": {
    "className": {"in": ["Multimedia Storage"]},
    "supplierPartNumber": {"in": ["LBW020433"]},
    "productId": [4],
    "sku": {"in": ["LI-1020-0006"]}
  },
  "paginationOptions": {"page": 1, "pageSize": 10}
}
Response
{
  "data": {
    "supplierCatalog": {
      "supplierId": 23403,
      "pageInfo": {
        "page": 1,
        "pageSize": 10,
        "hasNextPage": true,
        "totalPages": 5
      },
      "products": [
        {
          "productId": 23403,
          "upc": "877419111882",
          "supplierPartNumber": "LBW020433",
          "status": "LIVE",
          "skus": [
            {
              "productDescriptions": {
                "descriptions": [
                  {
                    "descriptionId": 127981781,
                    "descriptionType": "FEATURE_BULLET",
                    "rank": 1,
                    "value": "Machine Washable: No",
                    "isActive": true
                  }
                ]
              },
              "isLive": true,
              "sku": "UBAM1201",
              "collectionName": "Cerda",
              "displaySku": "UBAM1201",
              "productName": "Cerda 12V Heated Car Blanket",
              "className": "Blankets And Throws",
              "classId": 4,
              "retailPrice": {
                "unit": {"amount": 45, "currency": "USD"},
                "item": {"amount": 90, "currency": "USD"}
              },
              "urls": ["https://www.wayfair.com/UBAM1201"],
              "isWhiteLabeled": true,
              "status": "LIVE_PRODUCT",
              "productDimensions": {
                "lengthUnit": "in",
                "depth": 2,
                "height": 5,
                "width": 10,
                "weightUnit": "lb",
                "weight": 10
              },
              "productDetails": [
                {
                  "questionId": 23401,
                  "title": "Commercial Warranty",
                  "value": "Yes",
                  "description": "Does the product have a commercial warranty.",
                  "childProductDetails": [
                    {
                      "questionId": 923481,
                      "title": "Commercial Warranty Length",
                      "description": "The commercial warranty length",
                      "value": "60d"
                    }
                  ]
                }
              ],
              "minimumOrderQuantity": 2,
              "displaySetQuantity": 3,
              "forceMultiple": 2,
              "primaryImage": {
                "id": 248273478,
                "url": "https://assets.wfcdn.com/248273478.jpg"
              },
              "eligiblePrimaryImages": ["269422643", "269422646"],
              "manufacturer": {
                "id": 40001,
                "name": "East Urban Home",
                "brandType": "Exclusive Brand",
                "isWhiteLabel": true
              }
            }
          ],
          "images": [
            {"id": "248273478", "url": "https://assets.wfcdn.com/248273478.jpg"}
          ],
          "videos": [
            {"id": "248273478", "url": "https://assets.wfcdn.com/248273478.mp4"}
          ],
          "documents": [
            {"id": "248273478", "url": "https://assets.wfcdn.com/248273478.pdf"}
          ],
          "manufacturerPart": {"partId": 23403, "partNumber": "md81230_prod_1"},
          "mediaAssociationRequests": [
            {
              "mediaId": 269422643,
              "mediaType": "IMAGE",
              "requestType": "ADD",
              "status": "APPROVED"
            }
          ],
          "optionCombos": [1, 2, 3]
        }
      ]
    }
  }
}
Curl Command
Description
The following curl command demonstrates how to call the supplierCatalog query.

Be sure to replace the placeholder {JWT token} with your actual JWT token.

Also replace the variables {supplierId}, {className}, {supplierPartNumber}, {productId}, {sku}, {page} and {pageSize} to actual values.

curl --location 'https://api.wayfair.io/v1/supplier-catalog-api/graphql'
              --header 'Content-Type: application/json' --header 'Authorization: Bearer {JWT Token}' --data
              '{"query":"query GetSupplierCatalog(  $supplierId: Int!,  $filter: ProductFilter,  $paginationOptions: PaginationOptions) { supplierCatalog(supplierId: $supplierId, filter: $filter, paginationOptions: $paginationOptions) { supplierId pageInfo { page pageSize hasNextPage totalPages } products { productId upc supplierPartNumber status skus { productDescriptions { descriptions { descriptionId descriptionType rank value isActive } } isLive sku collectionName displaySku productName className classId retailPrice { unit { amount currency } item { amount currency } } urls isWhiteLabeled status productDimensions { lengthUnit depth height width weightUnit weight } productDetails { questionId title value description childProductDetails { questionId title description value } } minimumOrderQuantity displaySetQuantity forceMultiple primaryImage { id url } eligiblePrimaryImages manufacturer { brandType id isWhiteLabel name } } images { id url } videos { id url } documents { id url } manufacturerPart { partId partNumber } mediaAssociationRequests { mediaId mediaType requestType status } optionCombos } } }","variables":{"supplierId":"{supplierId}","filter": {"className": {"in": ["xxxxxx"]}, "supplierPartNumber": {"in": ["xxxxxx"]}, "productId": [xxxxx], "sku": {"in": ["xxxxx"]}},"paginationOptions": {"page":xxxxx, "pageSize": xxxxxx} }}'
supplierCatalog Sample Error
Multiple Filters
Description
This section demonstrates error scenarios for the supplierCatalog Query, where the query fails for some items due to Unauthorized Access. The request uses the same query as the successful example, but with different variables. For more information about errors, click on this link.

Example Request
Example Variables
{
  "supplierId": 23403,
  "filter": {
    "className": {
      "in": ["Multimedia Storage"]
    },
    "supplierPartNumber": {
      "in": ["LBW020433"]
    }
  },
  "paginationOptions": {
    "page": 1,
    "pageSize": 10
  }
}
Error Response
{
  "errors": [
    {
      "message": "Cannot pass multiple filter at a time",
      "extensions": {
        "category": "BAD_REQUEST"
      },
      "path": ["supplierCatalog"]
    }
  ],
  "data": null
}
Fatal Errors
Description
If you receive one of the following errors, your request was not processed. Please fix the issue and re-submit the request.

User Message	Description
Access Denied	Client does not have the READ-PRODUCT-CATALOG permission (read:catalog_products scope) to query supplier catalog
Validation Errors
Description
If you receive one of the following errors, fix the invalid input and submit another request.

User Message	Description
Cannot pass multiple filter at a time	Multiple filter criteria were provided (e.g., both className and supplierPartNumber); only one filter type is allowed per request
paginationOptions.pageSize Page Size must be a valid value [10, 20, 25]	The pageSize parameter must be one of the allowed values: 10, 20, or 25
paginationOptions.page Page Size must be a valid value >= 1	The page parameter must be 1 or greater
supplierId must be positive or zero	The supplierId parameter must be a non-negative integer
Types
AttributeDataType
Description
Available data types for class attributes.

Values
Enum Value	Description
BOOLEAN

A true or false value.
TEXT

A free-text value.
INTEGER

A whole number value.
DECIMAL

A numeric value with decimals.
SINGLE_CHOICE

A single selectable option from a list.
MULTI_CHOICE

Multiple selectable options from a list.
Example
"BOOLEAN"
Types
AttributePriority
Description
Available priority levels for a class attribute.

Values
Enum Value	Description
REQUIRED

Must be provided.
OPTIONAL

Can be provided but not required.
RECOMMENDED

Suggested but not mandatory.
Example
"REQUIRED"
Types
Boolean
Description
The Boolean scalar type represents true or false.

Example
true
                                
Types
BrandInput
Values
Enum Value	Description
WAYFAIR

Wayfair brand.
JOSS_AND_MAIN

Joss & Main brand.
PERIGOLD

Perigold brand.
ALLMODERN

AllModern brand.
BIRCHLANE

Birch Lane brand.
Example
"WAYFAIR"
Types
ChildClassAttribute
Description
A ChildClassAttribute further distinguishes a ClassAttribute.

Fields
Field Name	Description
id - Int!	An id for the class attribute.
name - String!	The name of the class attribute.
definition - String	A detailed description of the attribute, such as 'Is the height of this product adjustable?'
priority - AttributePriority!	The priority of the attribute.
dataType - AttributeDataType!	The datatype of the answer, such as Boolean, Text, Integer, etc.
isNotApplicableEligible - Boolean!	Determines whether or not this question is allowed to be answered as Does Not Apply
isUnavailableEligible - Boolean!	Determines whether or not this question is allowed to be answered as Unavailable
responseOptions - [ResponseOption!]!	The available responses for the attribute, if the dataType of the attribute supports it.
Example
{
  "id": 334697,
  "name": "Commercial Warranty Length",
  "definition": "How long does the manufacturer warranty apply for the product used in a non residential environment? If the correct value is not found, please indicate both the number and unit (Days, Months, Years) that is appropriate.",
  "priority": "REQUIRED",
  "dataType": "MULTI_CHOICE",
  "isNotApplicableEligible": false,
  "isUnavailableEligible": false,
  "responseOptions": [{"value": "30 Days"}, {"value": "60 Days"}]
}
Types
ChildProductDetails
Description
Secondary product detail that must be a child to some parent detail.

Fields
Field Name	Description
questionId - Int!	The id of the product detail question.
title - String!	A brief title that describes the child product detail.
description - String	A description of the question.
value - String	The display value for the child detail that ends up under the title on the product page.
Example
{
  "questionId": 923481,
  "title": "Commercial Warranty Length",
  "description": "The commercial warranty length",
  "value": "60d"
}
Types
ClassAttribute
Description
An attribute for a product class along with associated metadata, such as 'Height Adjustable'.

Fields
Field Name	Description
id - Int!	An id for the class attribute.
name - String!	The name of the class attribute.
definition - String	A detailed description of the attribute, such as 'Is the height of this product adjustable?'
dataType - AttributeDataType!	The datatype of the answer, such as Boolean, Text, Integer, etc.
priority - AttributePriority!	The priority of the attribute.
isNotApplicableEligible - Boolean!	Determines whether or not this question is allowed to be answered as Does Not Apply
isUnavailableEligible - Boolean!	Determines whether or not this question is allowed to be answered as Unavailable
responseOptions - [ResponseOption!]!	The available responses for the attribute, if the dataType of the attribute supports it.
childAttributes - [ChildClassAttribute!]!	Child attributes related to the current attribute.
Example
{
  "id": 238163,
  "name": "Commercial Warranty",
  "definition": "Does the manufacturer warranty cover the use of this product in a commercial environment?",
  "dataType": "BOOLEAN",
  "priority": "OPTIONAL",
  "isNotApplicableEligible": false,
  "isUnavailableEligible": false,
  "responseOptions": [{"value": "Yes"}, {"value": "No"}],
  "childAttributes": [
    {
      "id": 334697,
      "name": "Commercial Warranty Length",
      "definition": "How long does the manufacturer warranty apply for the product used in a non residential environment? If the correct value is not found, please indicate both the number and unit (Days, Months, Years) that is appropriate.",
      "priority": "REQUIRED",
      "dataType": "MULTI_CHOICE",
      "isNotApplicableEligible": false,
      "isUnavailableEligible": false,
      "responseOptions": [{"value": "30 Days"}, {"value": "60 Days"}]
    }
  ]
}
Types
ClassFilter
Description
Filters class search results.

Fields
Input Field	Description
id - IntegerFieldFilter	Filter results by class id.
className - StringFieldFilter	Filter results by class name.
Example
{"id": {"in": ["4"]}, "className": {"in": ["Multimedia Storage"]}}
Types
CountryInput
Values
Enum Value	Description
UNITED_STATES

U.S. catalog.
GERMANY

Germany Catalog.
UNITED_KINGDOM

U.K. catalog.
CANADA

Canada Catalog.
Example
"UNITED_STATES"
Types
CurrencyValue
Description
An amount and currency

Fields
Field Name	Description
amount - Float!	The numerical amount.
currency - String!	The international currency type. Example: USD, EUR, CAD
Example
{"amount": 45, "currency": "USD"}
Types
DescriptionBullet
Description
Information about all bulleted items under the features section

Fields
Field Name	Description
descriptionId - Int!	The description ID
descriptionType - DescriptionType!	The description type based on SchemaTagSection
rank - Int!	The order that the feature is displayed on the product page. Default is 1.
value - String!	The bullet description.
isActive - Boolean!	Whether or not the feature is displayed on the product page.
Example
{
  "descriptionId": 127981781,
  "descriptionType": "FEATURE_BULLET",
  "rank": 1,
  "value": "Machine Washable: No",
  "isActive": "TRUE"
}
Types
DescriptionType
Values
Enum Value	Description
MARKETING_COPY

Marketing content about the product.
FEATURE_BULLET

Key feature bullet points.
SPECIFICATIONS

Technical product details.
WARRANTY

Warranty terms and conditions.
ENERGY_COMPLIANCE

Energy rating or compliance details.
DIMENSIONS

Product size and measurements.
ASSEMBLY_INSTRUCTIONS

Instructions for product assembly.
DOCUMENTS

Additional supporting documents.
MANUFACTURER_INFO

Information from the manufacturer.
Example
"MARKETING_COPY"
Types
Document
Description
Document information within Wayfair.

Fields
Field Name	Description
id - ID!	The Wayfair ID for the document.
url - String	A link to the document on Wayfair's CDN.
Example
{"id": 248273478, "url": "https://assets.wfcdn.com/248273478.pdf"}
Types
FileName
Description
This is a scalar named FileName of type String designed to enforce restrictions on the format of a file name. It ensures that a file name must not include special characters such as "\", "/", ":" .

Example
"Image.png"
Types
Float
Description
The Float scalar type represents signed double-precision fractional values as specified by IEEE 754.

Example
987.65
Types
ID
Description
The ID scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as "4") or integer (such as 4) input value will be accepted as an ID.

Example
4
Types
Image
Description
Image information within Wayfair.

Fields
Field Name	Description
id - ID!	The Wayfair ID for the image.
url - String!	A link to the image on Wayfair's CDN.
Example
{"id": 248273478, "url": "https://assets.wfcdn.com/248273478.jpg"}
Types
Int
Description
The Int scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.

Example
123
Types
IntegerFieldFilter
Fields
Input Field	Description
in - [Int!]	Include all results with a value exactly equal to any item in this list.
notIn - [Int!]	Exclude all results with a value exactly equal to any item in this list.
Example
{"in": [1, 2, 3, 4], "notIn": [1, 2, 3, 4]}
Types
ManufacturerPart
Description
A manufacturer part.

Fields
Field Name	Description
partId - Int	The Wayfair ID.
partNumber - String	The manufacturer part number.
Example
{"partId": 23403, "partNumber": "md81230_prod_1"}
Types
MarketContext
Description
A combination of attributes that describe a market.

Fields
Field Name	Description
locale - String!	A locale comprises the language, territory, and code set combination used to identify a set of language conventions. It is Represented by a code with the “ll-CC” format, where “ll” is represented by ISO 639-1 (https://en.wikipedia.org/wiki/ISO_639-1) and “CC” is represented by ISO 3166-1 alpha-2 (https://www.iban.com/country-codes). Examples: en-US, en-GB, de-DE, fr-CA, etc.
country - String!	A unique country code ISO 3166-1 alpha-2 (https://www.iban.com/country-codes) that is used to represent a market of Wayfair. Examples: US (United States), DE (Germany), GB (United Kingdom)
brand - String!	Wayfair Family of Brands is an intangible marketing or business concept that helps people identify a company or product. Examples: WF (Wayfair), JM (Joss & Main), PG (Perigold), AM (AllModern), BL (Birch Lane)
Example
{"locale": "en-US", "country": "US", "brand": "WF"}
Types
MarketContextInput
Fields
Input Field	Description
locale - String!	A locale comprises the language, territory, and code set combination used to identify a set of language conventions. It is Represented by a code with the “ll-CC” format, where “ll” is represented by ISO 639-1 (https://en.wikipedia.org/wiki/ISO_639-1) and “CC” is represented by ISO 3166-1 alpha-2 (https://www.iban.com/country-codes). Examples: en-US, en-GB, de-DE, fr-CA, etc.
country - CountryInput!	The country that represents the Wayfair market.
brand - BrandInput!	Wayfair Family of Brands is an intangible marketing concept that helps people identify a company or product.
Example
{"locale": "en-US", "country": "UNITED_STATES", "brand": "WAYFAIR"}
Types
MediaAssociationRequest
Description
Information about a request to associate a media with a Product

Fields
Field Name	Description
mediaId - String	Media ID
mediaType - MediaType	Media Type
requestType - MediaRequestType!	Request Type
status - MediaRequestStatus!	Status of the request
Example
{
  "mediaId": 269422643,
  "mediaType": "IMAGE",
  "requestType": "ADD",
  "status": "APPROVED"
}
Types
MediaRequestStatus
Values
Enum Value	Description
APPROVED

Request has been approved.
ASSIGNED

Request assigned for processing.
CANCELLED

Request was cancelled.
COMPLETED

Processing is completed.
ESCALATED

Request has been escalated.
ON_HOLD

Request temporarily paused.
REJECTED

Request was rejected.
SUBMITTED

Request has been submitted.
UNSUBMITTED

Request not yet submitted.
EXPORTED

Request has been exported.
Example
"APPROVED"
Types
MediaRequestType
Values
Enum Value	Description
ADD

Add new media.
REPLACE

Replace existing media.
DELETE

Delete existing media.
Example
"ADD"
Types
MediaType
Values
Enum Value	Description
IMAGE

Image file.
VIDEO

Video file.
DOCUMENT

Document file.
MATERIAL

Material or asset file.
Example
"IMAGE"
Types
PaginationInfo
Description
The meta information about pagination.

Fields
Field Name	Description
page - Int!	The page number of the products that will be returned. The first page is 1.
pageSize - Int!	The requested number of products that will be returned per page. This value can be one of these: 10, 20, 25, 50.
hasNextPage - Boolean!	Whether or not the current pagination selection has a following page.
totalPages - Int!	The total number of pages that can displayed for the current dataset and pagination selection.
Example
{"page": 1, "pageSize": 10, "hasNextPage": true, "totalPages": 5}
Types
PaginationOptions
Description
Generic specification for paginating through a list of items.

Fields
Input Field	Description
page - Int	The page number of the products that will be returned. The first page is 1.
pageSize - Int	The requested number of products that will be returned per page. This value can be one of these: 10, 20, 25, 50.
Example
{"page": 1, "pageSize": 10}
Types
Price
Description
The price of a product.

Fields
Field Name	Description
unit - CurrencyValue	The unit price. Ex. price of a set of two barstools.
item - CurrencyValue	The item price. Ex. price of a single barstool.
Example
{
  "unit": {"amount": 45, "currency": "USD"},
  "item": {"amount": 90, "currency": "USD"}
}
Types
Product
Description
A supplier product.

Fields
Field Name	Description
productId - Int!	Product Id.
upc - String	UPC number.
supplierPartNumber - String	Supplier part number.
status - ProductStatus	Status representing if the product is purchasable on any store.
skus - [Sku]	SKU data that corresponds to the sellable product on the storefront.
images - [Image!]	Images associated with the product.
videos - [Video!]	Videos associated with the product.
documents - [Document!]	Documented associated with the product.
manufacturerPart - ManufacturerPart	Manufacturer part information.
mediaAssociationRequests - [MediaAssociationRequest!]	Media Association Requests for the product.
Example
{
  "productId": 23403,
  "upc": 877419111882,
  "supplierPartNumber": "LBW020433",
  "status": "LIVE",
  "skus": [
    {
      "productDescriptions": {
        "descriptions": [
          {
            "descriptionId": 127981781,
            "descriptionType": "FEATURE_BULLET",
            "rank": 1,
            "value": "Machine Washable: No",
            "isActive": "TRUE"
          }
        ]
      },
      "isLive": "TRUE",
      "sku": "UBAM1201",
      "collectionName": "Cerda",
      "displaySku": "UBAM1201",
      "productName": "Cerda 12V Heated Car Blanket",
      "className": "Blankets And Throws",
      "classId": 4,
      "retailPrice": {
        "unit": {"amount": 45, "currency": "USD"},
        "item": {"amount": 90, "currency": "USD"}
      },
      "urls": ["https://www.wayfair.com/UBAM1201"],
      "isWhiteLabeled": "TRUE",
      "status": "LIVE_PRODUCT",
      "productDimensions": {
        "lengthUnit": "in",
        "depth": 2,
        "height": 5,
        "width": 10,
        "weightUnit": "lb",
        "weight": 10
      },
      "productDetails": [
        {
          "questionId": 23401,
          "title": "Commercial Warranty",
          "value": "Yes",
          "description": "Does the product have a commercial warranty.",
          "childProductDetails": [
            {
              "questionId": 923481,
              "title": "Commercial Warranty Length",
              "description": "The commercial warranty length",
              "value": "60d"
            }
          ]
        }
      ],
      "minimumOrderQuantity": 2,
      "displaySetQuantity": 3,
      "forceMultiple": 2,
      "primaryImage": {
        "id": 248273478,
        "url": "https://assets.wfcdn.com/248273478.jpg"
      },
      "eligiblePrimaryImages": ["269422643", "269422646"],
      "manufacturer": {
        "id": 40001,
        "name": "East Urban Home",
        "brandType": "Exclusive Brand",
        "isWhiteLabel": "TRUE"
      }
    }
  ],
  "images": [
    {"id": "248273478", "url": "https://assets.wfcdn.com/248273478.jpg"}
  ],
  "videos": [
    {"id": "248273478", "url": "https://assets.wfcdn.com/248273478.mp4"}
  ],
  "documents": [
    {"id": "248273478", "url": "https://assets.wfcdn.com/248273478.pdf"}
  ],
  "manufacturerPart": [{"partId": 23403, "number": "md81230_prod_1"}],
  "mediaAssociationRequests": [
    {
      "mediaId": 269422643,
      "mediaType": "IMAGE",
      "requestType": "ADD",
      "status": "APPROVED"
    }
  ]
}
Types
ProductClass
Description
A single Wayfair product class, ie. 'Speaker Stands' or 'Audio Towers'.

Fields
Field Name	Description
classId - Int!	The id of the product class.
className - String!	The name of the product class.
definition - String	A detailed description of the class, such as 'CLASS OVERVIEW: This class includes all complete beds intended for...'
attributes - [ClassAttribute!]	A list of attributes belonging to the product class.
brandCatalogId - Int!	The brand catalog id. Use marketContext instead.
marketContext - MarketContext	The market context for this product class.
Example
{
  "classId": 78,
  "className": "Multimedia Storage",
  "definition": "Some definition of this class.",
  "attributes": [
    {
      "id": 18,
      "name": "Product Size",
      "definition": "The Size of the Product",
      "dataType": "MULTI_CHOICE",
      "priority": "REQUIRED",
      "isNotApplicableEligible": false,
      "isUnavailableEligible": false,
      "responseOptions": [{"value": "Small"}, {"value": "Big"}]
    }
  ],
  "brandCatalogId": 3,
  "marketContext": {
    "locale": "en-US",
    "country": "UNITED_STATES",
    "brand": "WAYFAIR"
  }
}
Types
ProductClasses
Description
Represents a page of product classes.

Fields
Field Name	Description
classes - [ProductClass!]!	The list of product classes being returned.
pageInfo - PaginationInfo!	The meta information about pagination.
cached - Boolean	Return true if classes was fetched from cache
Example
{
  "classes": [
    {
      "classId": 4,
      "className": "Multimedia Storage",
      "definition": "Some definition of this class",
      "marketContext": {
        "locale": "en-US",
        "country": "UNITED_STATES",
        "brand": "WAYFAIR"
      },
      "attributes": [
        {
          "id": 18,
          "name": "Product Size",
          "definition": "The Size of the Product",
          "dataType": "MULTI_CHOICE",
          "priority": "REQUIRED",
          "isNotApplicableEligible": false,
          "isUnavailableEligible": false,
          "responseOptions": [{"value": "Small"}, {"value": "Big"}]
        }
      ]
    }
  ],
  "pageInfo": {"page": 1, "pageSize": 10, "hasNextPage": true, "totalPages": 5},
  "cached": true
}
Types
ProductDetails
Description
A single product detail that specifies a class based detail about the product.

Fields
Field Name	Description
questionId - Int!	The id of the product detail question.
title - String!	A brief title that describes the product detail.
value - String	The display value for the product detail that ends up under the title on the product page.
description - String	A description of the question.
childProductDetails - [ChildProductDetails!]	Secondary product details underneath this detail.
Example
{
  "questionId": 23401,
  "title": "Commercial Warranty",
  "value": "Yes",
  "description": "Does the product have a commercial warranty.",
  "childProductDetails": [
    {
      "questionId": 923481,
      "title": "Commercial Warranty Length",
      "description": "The commercial warranty length",
      "value": "60d"
    }
  ]
}
Types
ProductDimensions
Description
The physical product dimensions.

Fields
Field Name	Description
lengthUnit - String	The unit all length fields are measured in.
depth - Float	The depth of the product.
height - Float	The height of the product.
width - Float	The width of the product.
weightUnit - String	The unit for weight.
weight - Float	The weight of the product.
Example
{
  "lengthUnit": "in",
  "depth": 2,
  "height": 5,
  "width": 10,
  "weightUnit": "lb",
  "weight": 10
}
Types
ProductFilter
Description
Filters the product search results, accepts only one filter at a time.

Fields
Input Field	Description
className - StringFieldFilter	Filter results by product class name.
supplierPartNumber - StringFieldFilter	Filter results by part number.
productId - [Int]	Filter results by productId.
sku - StringFieldFilter	Filter results by SKUs.
Example
{
  "className": {"in": ["Multimedia Storage"]},
  "supplierPartNumber": {"in": ["LBW020433"]},
  "productId": [4],
  "sku": {"in": ["LI-1020-0006"]}
}
Types
ProductStatus
Description
The status of a product.

Values
Enum Value	Description
LIVE

A Live Product status will show across all Partner Home tools. SKUs that are not live will only show on some Partner Home tools, and will often show different statuses depending on the tool.
UNPURCHASABLE

The product is not currently purchasable on all stores.
Example
"LIVE"
Types
ResponseOption
Description
An available response option for a class attribute.

Fields
Field Name	Description
value - String!	Text representation of the response option's value.
Example
{"value": "Large"}
Types
Sku
Description
A Wayfair SKU that represents much of the presentation data that ends up on the product page.

Fields
Field Name	Description
productDescriptions - SkuProductDescriptions	Product Descriptions for the SKU, including marketing copy, specifications, and warranty/assembly information.
isLive - Boolean	Whether or not the product is live on Wayfair.
sku - String!	The internal Wayfair SKU.
collectionName - String	The Wayfair collection this product belongs to.
displaySku - String	The SKU that is displayed to customers on the product page.
productName - String	The name of the product.
className - String	The name of the class.
classId - Int	The ID of the product class.
retailPrice - Price	The price information displayed to customers.
urls - [String!]	The urls that links to the product on Wayfair storefronts.
isWhiteLabeled - Boolean	Indicates if the product is white labeled.
status - SkuStatus	Status of the sku.
productDimensions - ProductDimensions	The physical dimensions of the product itself.
productDetails - [ProductDetails]	The product details that specify various details about the product.
minimumOrderQuantity - Int	The minimum number of products that must be sold at a time. (E.g. a customer cannot purchase fewer than 2 items).
displaySetQuantity - Int	The number of products sold in a set. (E.g. a customer makes one purchase for a set of 3 items).
forceMultiple - Int	The multiple this product must be sold in. (E.g. a customer can only order in the increment of 2 in addition to the minimum order quantity (4, 6, 8…items).
primaryImage - Image	Current Lead Image / Cover Image.
eligiblePrimaryImages - [String]	List of image's mediaId eligible to be Primary Image
manufacturer - SkuManufacturer	Information about the manufacturer of the SKU
Example
{
  "productDescriptions": {
    "descriptions": [
      {
        "descriptionId": 127981781,
        "descriptionType": "FEATURE_BULLET",
        "rank": 1,
        "value": "Machine Washable: No",
        "isActive": "TRUE"
      }
    ]
  },
  "isLive": "TRUE",
  "sku": "UBAM1201",
  "collectionName": "Cerda",
  "displaySku": "UBAM1201",
  "productName": "Cerda 12V Heated Car Blanket",
  "className": "Blankets And Throws",
  "classId": 4,
  "retailPrice": {
    "unit": {"amount": 45, "currency": "USD"},
    "item": {"amount": 90, "currency": "USD"}
  },
  "urls": ["https://www.wayfair.com/UBAM1201"],
  "isWhiteLabeled": "TRUE",
  "status": "LIVE_PRODUCT",
  "productDimensions": {
    "lengthUnit": "in",
    "depth": 2,
    "height": 5,
    "width": 10,
    "weightUnit": "lb",
    "weight": 10
  },
  "productDetails": [
    {
      "questionId": 23401,
      "title": "Commercial Warranty",
      "value": "Yes",
      "description": "Does the product have a commercial warranty.",
      "childProductDetails": [
        {
          "questionId": 923481,
          "title": "Commercial Warranty Length",
          "description": "The commercial warranty length",
          "value": "60d"
        }
      ]
    }
  ],
  "minimumOrderQuantity": 2,
  "displaySetQuantity": 3,
  "forceMultiple": 2,
  "primaryImage": {
    "id": 248273478,
    "url": "https://assets.wfcdn.com/248273478.jpg"
  },
  "eligiblePrimaryImages": ["269422643", "269422646"],
  "manufacturer": {
    "id": 40001,
    "name": "East Urban Home",
    "brandType": "Exclusive Brand",
    "isWhiteLabel": "TRUE"
  }
}
Types
SkuManufacturer
Description
Information about the manufacturer

Fields
Field Name	Description
brandType - String!	The type of the brand
id - Int!	The id of the manufacturer
isWhiteLabel - Boolean!	Whether this manufacturer is white label one
name - String!	The name of the manufacturer
Example
{
  "brandType": "Exclusive Brand",
  "id": 40001,
  "isWhiteLabel": "TRUE",
  "name": "East Urban Home"
}
Types
SkuProductDescriptions
Description
All description information associated with a SKU.

Fields
Field Name	Description
descriptions - [DescriptionBullet]	List of all descriptions, marketing copy, features, dimensions, warranty, etc.
Example
{
  "descriptions": [
    {
      "descriptionId": 127981781,
      "descriptionType": "FEATURE_BULLET",
      "rank": 1,
      "value": "Machine Washable: No",
      "isActive": "TRUE"
    }
  ]
}
Types
SkuStatus
Description
The status of the SKU.

Values
Enum Value	Description
CAN_BE_DELETED

Can be deleted.
BEING_ADDED

Your product is in the process of being published on the website.
KIT_COMPONENT

This product cannot be sold alone and should only be live when included in a kit or as part of a composite SKU.
ADMIN_CAN_SELL

Admin can sell.
LIVE_PRODUCT

The product is live and purchasable on the any store.
MANUFACTURER_DISCONTINUED

Your product has been discontinued by the manufacturer.
SUPPLIER_DISCONTINUED

Your inventory feed indicates that this product is discontinued by the supplier.
INTERNAL_DISCONTINUED

Your inventory feed indicates that this product is discontinued.
PHASING_OUT_STILL_STOCK

Your inventory feed indicates that this product is discontinued.
DO_NOT_SELL_TEMP_HOLD

Do not sell temp hold.
INDETERMINATE_BACKORDER

Your product was removed because you indicated that it is out of stock.
REPLACEMENT_PART_ONLY

Replacement part only.
KIT_COMPONENT_PHASING_OUT

Your inventory feed indicates that this product is discontinued.
SUPER_RELATED_ITEM_ONLY

Your product is only offered as an additional bonus when customers are shopping our catalog.
RETURN_ITEM_ONLY

Your product has been returned to Wayfair warehouses, but isn’t considered sellable based on product quality. Your items can be sold on clearance center as open box items.
KIT_COMPONENT_DISCONTINUED

Your inventory feed indicates that this product is discontinued.
GIFT_CERTIFICATE

Gift certificate.
DO_NOT_USE_PRIVATE_SALE

Do not use private sale.
Example
"CAN_BE_DELETED"
Types
String
Description
The String scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.

Example
"xyz789"
Types
StringFieldFilter
Description
Filtering options for string fields

Fields
Input Field	Description
in - [String!]	Include all results with a value exactly equal to any item in this list.
notIn - [String!]	Exclude all results with a value exactly equal to any item in this list.
contains - String	Include all results where the value contains this string as a substring.
notContains - String	Exclude all results where the value contains this string as a substring.
Example
{
  "in": ["Multimedia Storage", "Portable Tool Storage"],
  "notIn": ["Multimedia Storage", "Portable Tool Storage"],
  "contains": "Multimedia Storage",
  "notContains": "Multimedia Storage"
}
Types
SupplierCatalog
Description
Represents a page of products.

Fields
Field Name	Description
supplierId - Int!	The ID of the supplier.
pageInfo - PaginationInfo!	The meta information about pagination.
products - [Product]!	The products based on the current limit, offset, and supplier ID.
Example
{
  "supplierId": 23403,
  "pageInfo": {"page": 1, "pageSize": 10, "hasNextPage": true, "totalPages": 5},
  "products": [
    {
      "productId": 23403,
      "upc": 877419111882,
      "supplierPartNumber": "LBW020433",
      "status": "LIVE",
      "skus": [
        {
          "productDescriptions": {
            "descriptions": [
              {
                "descriptionId": 127981781,
                "descriptionType": "FEATURE_BULLET",
                "rank": 1,
                "value": "Machine Washable: No",
                "isActive": "TRUE"
              }
            ]
          },
          "isLive": "TRUE",
          "sku": "UBAM1201",
          "collectionName": "Cerda",
          "displaySku": "UBAM1201",
          "productName": "Cerda 12V Heated Car Blanket",
          "className": "Blankets And Throws",
          "classId": 4,
          "retailPrice": {
            "unit": {"amount": 45, "currency": "USD"},
            "item": {"amount": 90, "currency": "USD"}
          },
          "urls": ["https://www.wayfair.com/UBAM1201"],
          "isWhiteLabeled": "TRUE",
          "status": "LIVE_PRODUCT",
          "productDimensions": {
            "lengthUnit": "in",
            "depth": 2,
            "height": 5,
            "width": 10,
            "weightUnit": "lb",
            "weight": 10
          },
          "productDetails": [
            {
              "questionId": 23401,
              "title": "Commercial Warranty",
              "value": "Yes",
              "description": "Does the product have a commercial warranty.",
              "childProductDetails": [
                {
                  "questionId": 923481,
                  "title": "Commercial Warranty Length",
                  "description": "The commercial warranty length",
                  "value": "60d"
                }
              ]
            }
          ],
          "minimumOrderQuantity": 2,
          "displaySetQuantity": 3,
          "forceMultiple": 2,
          "primaryImage": {
            "id": 248273478,
            "url": "https://assets.wfcdn.com/248273478.jpg"
          },
          "eligiblePrimaryImages": ["269422643", "269422646"],
          "manufacturer": {
            "id": 40001,
            "name": "East Urban Home",
            "brandType": "Exclusive Brand",
            "isWhiteLabel": "TRUE"
          }
        }
      ],
      "images": [
        {"id": "248273478", "url": "https://assets.wfcdn.com/248273478.jpg"}
      ],
      "videos": [
        {"id": "248273478", "url": "https://assets.wfcdn.com/248273478.mp4"}
      ],
      "documents": [
        {"id": "248273478", "url": "https://assets.wfcdn.com/248273478.pdf"}
      ],
      "manufacturerPart": [{"partId": 23403, "number": "md81230_prod_1"}],
      "mediaAssociationRequests": [
        {
          "mediaId": 269422643,
          "mediaType": "IMAGE",
          "requestType": "ADD",
          "status": "APPROVED"
        }
      ],
      "optionCombos": [1, 2, 3]
    }
  ]
}
Types
UploadFailureReason
Description
Provides details on why an upload has failed.

Values
Enum Value	Description
INVALID_TYPE

A type other than one of these valid types was provided: pdf, png, jpg, jpeg, mp4, mov, wmv
DOWNLOAD_ERROR

For some reason an error occurred while the service attempted to download the file.
UPLOAD_ERROR

General error meaning that something went wrong while uploading the file to our servers and clients should retry.
INVALID_URL

URL must match the following regex: (https?://(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-][a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-][a-zA-Z0-9]\.[^\s]{2,}|https?://(?:www\.|(?!www))[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9]\.[^\s]{2,})
VALID_URL_INVALID_FILE_NAME

The URL passed the URL check but did not pass the filename check. The distinction between this status and simply INVALID_FILENAME is that the downstream service accepts files in a few different ways and the URL field isn't always a required field for the downstream system, so they need to be able to handle both situations: with, or without the URL.
INVALID_FILE_NAME

The length of the file name was longer than 200 characters.
Example
"INVALID_TYPE"
Types
UploadMediaURLInput
Description
The input to upload media using a URL.

Fields
Input Field	Description
supplierPartNumber - ID!	The supplierPartNumber to which this media belongs.
mediaType - MediaType!	The type of media.
name - FileName!	The name of the file.
url - String!	The public URL hosting the media.
Example
{
  "supplierPartNumber": "LBW020433",
  "mediaType": "IMAGE",
  "name": "Image.png",
  "url": "https://images.salsify.com/1298012.jpg"
}
Types
UploadMediaURLResponse
Description
The response of the upload media with URL.

Fields
Field Name	Description
actionId - String	A unique ID which identifies this specific request in the system. See the uploadedMediaByActionId query.
success - Boolean!	Indicates whether or not the association has been requested.
error - [String]	A list of errors (if any) which occurred while processing this request.
Example
{
  "actionId": "4773e8a6-1932-14ef-9669-5ea337f4aa39",
  "success": true,
  "error": ["Some Error Message"]
}
Types
UploadedMedia
Description
Uploaded media data

Fields
Field Name	Description
id - String	The id of the upload record No longer supported
name - String	Actual Name of the media.
uploadName - String!	Name that was submitted during the upload request which can be different than the actual name in case the media was previously uploaded.
actionId - String!	The actionId for which this media was submitted.
mediaId - Int	The id of the media uploaded.
assetType - MediaType!	The type of the media.
uploadStatus - UploadedMediaStatus!	The status of the upload of the media.
linkStatus - UploadedMediaLinkStatus!	The status of the linking of the media.
tagStatus - UploadedMediaTagStatus!	The status of the tagging of the media.
uploadFailureReason - UploadFailureReason	A potential failure reason of the upload.
Example
{
  "id": "xyz789",
  "name": "e685718eeb9d19c23d26a603a77c2e8.jpg",
  "uploadName": "e685718eeb9d19c23d26a603a77c2e8.jpg",
  "actionId": "4773e8a6-1932-14ef-9669-5ea337f4aa39",
  "mediaId": 269422643,
  "assetType": "IMAGE",
  "uploadStatus": "SUCCESSFUL",
  "linkStatus": "SUCCESSFUL",
  "tagStatus": "TAGGED",
  "uploadFailureReason": "UPLOAD_ERROR"
}
Types
UploadedMediaByActionIdRes
Description
Paginated response object of media uploads.

Fields
Field Name	Description
pageInfo - PaginationInfo	The meta information about pagination.
uploads - [UploadedMedia]	List of media found.
error - String	Errors that indicate that the request was invalid.
Example
{
  "pageInfo": {"page": 1, "pageSize": 10, "hasNextPage": true, "totalPages": 5},
  "uploads": [
    {
      "id": "d8f24ca2-ab65-491d-a4b7-8b7418f936fc",
      "name": "e685718eeb9d19c23d26a603a77c2e8.jpg",
      "uploadName": "e685718eeb9d19c23d26a603a77c2e8.jpg",
      "actionId": "4773e8a6-1932-14ef-9669-5ea337f4aa39",
      "mediaId": 269422643,
      "assetType": "IMAGE",
      "uploadStatus": "SUCCESSFUL",
      "linkStatus": "SUCCESSFUL",
      "tagStatus": "TAGGED",
      "uploadFailureReason": "UPLOAD_ERROR"
    }
  ],
  "error": "actionId is not a valid UUID"
}
Types
UploadedMediaFilter
Description
Filter for uploaded media by either upload or link status.

Fields
Input Field	Description
uploadStatus - [UploadedMediaStatus!]	A list of upload statuses to filter by.
linkStatus - [UploadedMediaLinkStatus!]	A list of link statuses to filter by.
Example
{"uploadStatus": ["SUCCESSFUL"], "linkStatus": ["PENDING"]}
Types
UploadedMediaLinkStatus
Description
Provides details on the linking status.

Values
Enum Value	Description
NONE

No link to a product or auto association was requested.
PENDING

Media file is currently in process.
SUCCESSFUL

Media file was successfully uploaded.
FAILED

Media file failed upload process
CLEARED

The request has been removed (typically by the supplier). Example being if an upload is in failed status and a user dismisses the notification in Partner Home it will clear the failed upload so they will never see these uploads again.
Example
"NONE"
Types
UploadedMediaStatus
Description
Provides details on the upload status.

Values
Enum Value	Description
NOT_RECEIVED

Media file not provided by the user in the specification sheet through Partner Home import tool.
PENDING

Media file is currently in process.
SUCCESSFUL

Media file was successfully uploaded.
FAILED

Media file failed upload process
CLEARED

The request has been removed (typically by the supplier). Example being if an upload is in failed status and a user dismisses the notification in Partner Home it will clear the failed upload so they will never see these uploads again.
Example
"NOT_RECEIVED"
Types
UploadedMediaTagStatus
Description
Provides details on the tagging status.

Values
Enum Value	Description
PENDING

Awaiting Completion
TAGGED

Media has been successfully tagged.
NOT_TAGGED

Media has not been tagged.
Example
"PENDING"
Types
UploadedMedias
Description
Paginated response object of media uploads.

Fields
Field Name	Description
pageInfo - PaginationInfo!	The meta information about pagination.
count - Int!	Number of results found. Use the pageInfo object instead
uploads - [UploadedMedia!]!	List of media found.
Example
{
  "pageInfo": {"page": 1, "pageSize": 10, "hasNextPage": true, "totalPages": 5},
  "count": 100,
  "uploads": [
    {
      "id": "d8f24ca2-ab65-491d-a4b7-8b7418f936fc",
      "name": "e685718eeb9d19c23d26a603a77c2e8.jpg",
      "uploadName": "e685718eeb9d19c23d26a603a77c2e8.jpg",
      "actionId": "4773e8a6-1932-14ef-9669-5ea337f4aa39",
      "mediaId": 269422643,
      "assetType": "IMAGE",
      "uploadStatus": "SUCCESSFUL",
      "linkStatus": "SUCCESSFUL",
      "tagStatus": "TAGGED",
      "uploadFailureReason": "UPLOAD_ERROR"
    }
  ]
}
Types
Video
Description
Video information within Wayfair.

Fields
Field Name	Description
id - ID!	The Wayfair ID for the video.
url - String	A link to the video on Wayfair's CDN.

Example
{"id": 248273478, "url": "https://assets.wfcdn.com/248273478.mp4"}