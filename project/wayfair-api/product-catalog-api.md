Product Addition API
Allows Wayfair suppliers to manage their respective catalogs.

Contact
Terms of Service
https://terms.wayfair.io

API Endpoints
# Production Server:
https://api.wayfair.io/v1/product-catalog-api/graphql
# Sandbox Server:
https://api.wayfair.io/sandbox/v1/product-catalog-api/graphql
Queries
brandAssociations
Description
Fetches brands associated with a given supplier and market context.

Required permission is : Read-SUPPLIER-BRAND-ASSOCIATIONS
Response
Returns a GetSupplierBrandsAssociationsResponse

Arguments
Name	Description
request - GetSupplierBrandsAssociationsRequest	Encapsulates the input for the productAddition brandAssociations query.
Example
Query
query brandAssociations($request: GetSupplierBrandsAssociationsRequest) {
  supplierBrand {
    brandAssociations(request: $request) {
    brands {
      id
      manufacturer {
        id
        name
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      totalPages
      }
    }
  }
}
Variables
{
  "request": {
    "supplierId": 12345,
    "marketContext": {
      "brand": "WAYFAIR",
      "country": "US",
      "locale": "en_US"
    },
    "page": 1,
    "pageSize": 10
  }
}
Response
{
  "data": {
    "supplierBrand": {
      "brandAssociations": {
        "brands": [
          {
            "id": 123,
            "manufacturer": {
              "id": 456,
              "name": "Example Manufacturer"
            }
          }
        ],
        "pageInfo": {
          "hasNextPage": false,
          "hasPreviousPage": false,
          "totalPages": 1
        }
      }
    }
  }
}
Curl Command
Description
The following curl command demonstrates how to call the brandAssociations query.

Please ensure to replace the placeholder {JWT token} with your actual JWT token.

Also replace the variables {supplierId}, {locale}, {country}, {brand}, {page}, and {pageSize} with actual values.

curl --location 'https://api.wayfair.io/v1/product-catalog-api/graphql' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {JWT token}' \
--data '{"query":"query brandQuery(\n    $request: GetSupplierBrandsAssociationsRequest!\n) {\n\tsupplierBrand {\n\t\tbrandAssociations(\n            request: $request\n\t\t) {\n            brands{\n                id\n                manufacturer{\n                     id\n                     name\n                }\n            }\n            pageInfo{\n                hasPreviousPage\n                hasNextPage\n                totalPages\n            }\n\t\t}\n\t}\n}\n","variables":{"request":{"supplierId":XXXXXX,"marketContext":{"locale":XXXXXX,"country":XXXXXX,"brand":XXXXXX},"page":XXXXXX,"pageSize":XXXXXX}}}'
              
brandAssociations Sample Error
Description
This section demonstrates error scenarios for the brandAssociations Query, where the query fails for invalid permission. The request uses the same query as the successful example, but with different variables. For more information about errors, click on this link.

Example - Server Error
Example Variables

{
  "request": {
    "supplierId": 12345,
    "marketContext": {
      "brand": "WAYFAIR",
      "country": "US",
      "locale": "en_US"
    },
    "page": 1,
    "pageSize": 10
  }
}
Error Response
{
  "errors": [
    {
      "message": "Access Denied",
      "extensions": {
        "category": "PERMISSION_DENIED"
      },
      "path": ["supplierBrand", "brandAssociations"]
    }
  ],
  "data": null
}
Fatal Errors
Description
If you receive one of the following errors, your request was not processed. Please fix the issue and re-submit the request.

User Message	Description
Access Denied	Client does not have READ_BRANDS permission for the specified supplier.
Validation Errors
Description
If you receive one of the following errors, fix the invalid input and submit another request.

User Message	Description
Invalid supplier ID provided	supplierId does not exist or is invalid.
Market context validation error	The provided market context is invalid or incomplete
mediaMetaDataTags
Description
Retrieve media meta data tags

Required permission is : READ-MEDIA-METADATA-TAGS
Response
Returns [MediaMetaDataTagSet!]!

Arguments
Name	Description
mediaMetaDataTag - MediaMetaDataTagInput!	Media metadata tag input filter
Example
Query
query GetMediaMetaDataTags($input: MediaMetaDataTagInput!) {
  media {
    mediaMetaDataTags(mediaMetaDataTag: $input) {
      metaDataTagType
      metaDataTags {
        metaDataId
        name
      }
    }
  }
}
Variables
{
  "input": {
    "metaDataTagTypes": [
      "DOCUMENT",
      "LEGAL_DOCUMENT",
      "LANGUAGE",
      "REGION"
    ],
    "marketContext": {
      "locale": "en-US",
      "country": "UNITED_STATES",
      "brand": "WAYFAIR"
    }
  }
}
Response
{
    "data": {
        "media": {
            "mediaMetaDataTags": [
                {
                    "metaDataTagType": "LANGUAGE",
                    "metaDataTags": [
                        {
                            "metaDataId": "252",
                            "name": "Arabic"
                        },
                        {
                            "metaDataId": "258",
                            "name": "English (United Kingdom)"
                        },
                        {
                            "metaDataId": "259",
                            "name": "English (United States)"
                        },
                        {
                            "metaDataId": "260",
                            "name": "Spanish"
                        },
                        {
                            "metaDataId": "267",
                            "name": "Japanese"
                        }
                    ]
                },
                {
                    "metaDataTagType": "LEGAL_DOCUMENT",
                    "metaDataTags": [
                        {
                            "metaDataId": "1498",
                            "name": "AAFA Certified"
                        },
                        {
                            "metaDataId": "1607",
                            "name": "CE Certified"
                        },
                        {
                            "metaDataId": "1649",
                            "name": "CPSIA Compliant"
                        },
                        {
                            "metaDataId": "1702",
                            "name": "ENERGY STAR Certified"
                        },
                        {
                            "metaDataId": "1730",
                            "name": "GREENGUARD Certified"
                        }
                    ]
                },
                {
                    "metaDataTagType": "DOCUMENT",
                    "metaDataTags": [
                        {
                            "metaDataId": "1224",
                            "name": "Specifications"
                        },
                        {
                            "metaDataId": "1225",
                            "name": "Installation & Assembly"
                        },
                        {
                            "metaDataId": "1226",
                            "name": "Owner Manual"
                        },
                        {
                            "metaDataId": "1228",
                            "name": "Warranty Information"
                        },
                        {
                            "metaDataId": "1235",
                            "name": "Energy Guide"
                        }
                    ]
                },
                {
                    "metaDataTagType": "REGION",
                    "metaDataTags": [
                        {
                            "metaDataId": "281",
                            "name": "US"
                        },
                        {
                            "metaDataId": "282",
                            "name": "UK"
                        },
                        {
                            "metaDataId": "283",
                            "name": "EU"
                        },
                        {
                            "metaDataId": "284",
                            "name": "CA"
                        }
                    ]
                }
            ]
        }
    }
}
Curl Command
Description
The following curl command demonstrates how to call the brandAssociations query.

Be sure to replace the placeholder {JWT token} with your actual JWT token.

Also replace the variables {supplierId}, {locale}, {country}, {brand}, {page} and {pageSize} to actual values.

curl --location 'https://api.wayfair.io/v1/product-catalog-api/graphql'
--header 'Content-Type: application/json'
--header 'Authorization: Bearer {JWT Token}'
--data '{"query":"query GetMediaMetaDataTags($input: MediaMetaDataTagInput!) { media { mediaMetaDataTags(mediaMetaDataTag: $input) { metaDataTagType, metaDataTags { metaDataId, name } } } }","variables":{"input":{"metaDataTagTypes":["xxxxxx"],"marketContext":{"brand":"xxxx","country":"xxxx","locale":"xxxx"}}}}'
              
mediaMetaDataTags Sample Error
Description
This section demonstrates error scenarios for the mediaMetaDataTags Query, where the query fails for invalid permission. The request uses the same query as the successful example, but with different variables. For more information about errors, click on this link.

Example - Request
Example Variables
{
  "input": {
    "marketContext": {
      "brand": "INVALID_BRAND",
      "country": "US",
      "locale": "en_US"
    }
  }
}
Error Response

{
  "errors": [
    {
      "message": "Product Addition mediaMetaDataTags errors were detected: No brand catalog id found for market context.",
      "extensions": {
        "category": "BAD_REQUEST"
      },
      "path": ["media", "mediaMetaDataTags"]
    }
  ],
  "data": null
}
Fatal Errors
Description
If you receive one of the following errors, your request was not processed. Please fix the issue and re-submit the request.

User Message	Description
Access Denied	Client does not have the READ_CATALOG_MEDIA permission to query media metadata tags.
Validation Errors
Description
If you receive one of the following errors, fix the invalid input and submit another request.

User Message	Description
No brand catalog id found for market context	The provided market context does not map to a valid brand catalog.
questions
Description
Fetches product addition questions for a given combination of supplierId, marketContext, and classId. For details about each input parameter, see the documentation for the GetProductAdditionQuestionsRequest type.

Returns generic and class-specific questions, in a format suitable for hydrating UI components.

Required permission is : READ-PRODUCT-ADDITION-QUESTIONS
Response
Returns [ProductAdditionQuestion]!

Arguments
Name	Description
request - GetProductAdditionQuestionsRequest!	Encapsulates the input for productAddition.questions query
Example
Query
query GetQuestions($request: GetProductAdditionQuestionsRequest!) {
    productAddition {
        questions(
            request: $request
        ) {
            id
            parentId
            internalName
            displayName
            answerType
            isActive
            isMultiValue
            childQuestions {
                id
                parentId
                internalName
                displayName
                isActive
                isMultiValue
                answerType
                possibleAnswers {
                    key
                    value
                }
                importanceType
            }
            possibleAnswers {
                key
                value
            }
            isUnavailableEligible
            isNotApplicableEligible

        }
    }
}
Variables
{
    "request": {
        "supplierId": 12345,
        "classId": 167,
        "marketContext": {
            "locale": "en-US",
            "country": "UNITED_STATES",
            "brand": "WAYFAIR"
        }
    }
}
Response
{
    "data": {
        "productAddition": {
            "questions": [
                {
                    "id": "core::supplierPartNumber",
                    "internalName": "supplierPartNumber",
                    "displayName": "Supplier Part Number",
                    "answerType": "STRING",
                    "isActive": true,
                    "isMultiValue": false,
                    "childQuestions": [],
                    "possibleAnswers": []
                },
                {
                    "id": "price::wholesalePrice",
                    "internalName": "wholesalePrice",
                    "displayName": "Base Cost",
                    "answerType": "DECIMAL",
                    "isActive": true,
                    "isMultiValue": false,
                    "childQuestions": [],
                    "possibleAnswers": []
                },
                {
                    "id": "shippingAndFulfillment::shipType",
                    "internalName": "shipType",
                    "displayName": "Ship Type",
                    "answerType": "SINGLE_CHOICE",
                    "isActive": true,
                    "isMultiValue": false,
                    "childQuestions": [],
                    "possibleAnswers": [
                        {
                            "key": "SMALL_PARCEL",
                            "value": "Small Parcel"
                        },
                        {
                            "key": "LTL",
                            "value": "LTL"
                        }
                    ]
                },
                {
                    "id": "shippingAndFulfillment::flatPack",
                    "internalName": "flatPack",
                    "displayName": "Flat Pack",
                    "answerType": "BOOLEAN",
                    "isActive": true,
                    "isMultiValue": false,
                    "childQuestions": [],
                    "possibleAnswers": [
                        {
                            "key": "YES",
                            "value": "Yes"
                        },
                        {
                            "key": "NO",
                            "value": "No"
                        }
                    ]
                },
                {
                    "id": "shippingAndFulfillment::cartons",
                    "internalName": "cartons",
                    "displayName": "Cartons",
                    "isActive": true,
                    "isMultiValue": true,
                    "childQuestions": [
                        {
                            "id": "shippingAndFulfillment::weight",
                            "answerType": "DECIMAL",
                            "possibleAnswers": [],
                            "importanceType": "CONDITIONAL"
                        },
                        {
                            "id": "shippingAndFulfillment::height",
                            "answerType": "DECIMAL",
                            "possibleAnswers": [],
                            "importanceType": "CONDITIONAL"
                        },
                        {
                            "id": "shippingAndFulfillment::width",
                            "answerType": "DECIMAL",
                            "possibleAnswers": [],
                            "importanceType": "CONDITIONAL"
                        },
                        {
                            "id": "shippingAndFulfillment::depth",
                            "answerType": "DECIMAL",
                            "possibleAnswers": [],
                            "importanceType": "CONDITIONAL"
                        }
                    ],
                    "possibleAnswers": []
                }
            ]
        }
    }
}
Curl Command
Description
The following curl command demonstrates how to call the questions query.

Be sure to replace the placeholder {JWT token} with your actual JWT token.

Also replace the variables {supplierId}, {brand}, {country}, {locale} and {classId} to actual values.


                curl --location 'https://api.wayfair.io/v1/product-catalog-api/graphql'
--header 'Content-Type: application/json'
--header 'Authorization: Bearer XXXXX'
--data '{"query":"query GetQuestions($request: GetProductAdditionQuestionsRequest!) {\n productAddition {\n questions(\n request: $request\n ) {\n id\n parentId\n internalName\n displayName\n answerType\n isActive\n isMultiValue\n childQuestions {\n id\n parentId\n internalName\n displayName\n isActive\n isMultiValue\n answerType\n possibleAnswers {\n key\n value\n }\n importanceType\n }\n possibleAnswers {\n key\n value\n }\n isUnavailableEligible\n isNotApplicableEligible\n \n }\n }\n}","variables":{"request":{"marketContext":{"brand":xxxxx,"country":xxxxx,"locale":xxxxx},"classId":xxxxx,"supplierId":xxxxx}}}'
              
questions Sample Error
Description
This section demonstrates error scenarios for the questions Query, where the query fails for invalid data. The request uses the same query as the successful example, but with different variables. For more information about errors, click on this link.

Example - Invalid Class ID
Example Variables

{
  "request": {
    "supplierId": "12345",
    "marketContext": {
      "brand": "WAYFAIR",
      "country": "US",
      "locale": "en_US"
    },
    "classId": 999999
  }
}
Error Response

{
  "errors": [
    {
      "message": "No class specific questions found for requested class: 999999",
      "extensions": {
        "category": "BAD_REQUEST"
      },
      "path": ["productAddition", "questions"]
    }
  ],
  "data": null
}
Fatal Errors
Description
If you receive one of the following errors, your request was not processed. Please fix the issue and re-submit the request.

User Message	Description
Access Denied	Client does not have the READ_QUESTIONS permission for the specified supplier.
Validation Errors
Description
If you receive one of the following errors, fix the invalid input and submit another request.

User Message	Description
No class specific questions found for requested class: [classId]	The provided classId does not exist or has no questions associated with it.
Locale is required for descriptionsByPart	The locale field is required in the marketContext input
submissions
Description
Fetches product additions by request ids. The output of the productAddition.submit mutation is typically the input for this query.

Returns an array of product addition objects which, most notably, include statuses and possibly validation flaws. Statuses can be polled for changes.

Required permission is : READ-PRODUCT-ADDITION-SUBMISSIONS
Response
Returns [ProductAddition]

Arguments
Name	Description
request - GetProductAdditionsRequest!	Encapsulates the required and optional inputs needed to fetch product addition requests.
Example
Query
query submissions($request: GetProductAdditionsRequest!) {
  productAddition {
    submissions(request: $request) {
      requestId
      supplierId
      supplierPartNumber
      classId
      marketContext {
        locale
        country
        brand
      }
      partId
      partType
      status
      validationStatus
      submissionStatus
      validationFlaws {
        partId
        questionId
        parentRank
        rank
        flawType
        flaw
      }
    }
  }
                                    }
Variables
{
  "supplierId": 12345,
  "requestIds": [
    "4fda53c9-ff5c-475c-bf42-c2494f7ce1b4"
  ]
}
Response
{
    "data": {
        "productAddition": {
            "submissions": []
        }
    }
}
Curl Command
Description
The following curl command demonstrates how to call the submissions query.

Be sure to replace the placeholder {JWT token} with your actual JWT token.

Also replace the variables {supplierId} and {ids} to actual values.

curl --location 'https://api.wayfair.io/v1/product-catalog-api/graphql' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {JWT Token}' \
--data '{"query":"query submissions($request: GetProductAdditionsRequest!) { productAddition { submissions(request: $request) { requestId supplierId supplierPartNumber classId marketContext { locale country brand } partId partType status validationStatus submissionStatus validationFlaws { partId questionId parentRank rank flawType flaw } } } }","variables":{"request":{"supplierId":xxxxx,"ids":[xxxxx,xxxxx]}}}'
submissions Sample Error
Description
This section demonstrates error scenarios for the submissions Query, where the query fails for invalid data. The request uses the same query as the successful example, but with different variables. For more information about errors, click on this link.

Example - Invalid UUID Format
Example Variables

{
  "request": {
    "supplierId": "12345",
    "ids": ["invalid-uuid-format", "another-bad-id"]
  }
}
Error Response

{
  "errors": [
    {
      "message": "Invalid UUID string: invalid-uuid-format",
      "extensions": {
        "category": "BAD_REQUEST"
      },
      "path": ["productAddition", "submissions"]
    }
  ],
  "data": null
}
Fatal Errors
Description
If you receive one of the following errors, your request was not processed. Please fix the issue and re-submit the request.

User Message	Description
Access Denied	Client does not have the READ_SUBMISSIONS permission for the specified supplier.
Validation Errors
Description
If you receive one of the following errors, fix the invalid input and submit another request.

User Message	Description
Invalid UUID string: [uuid]	One or more request IDs are not valid UUID format.
Product Addition Id '[requestId]' is invalid	The provided request ID does not exist or is not accessible
taxonomyCategories
Description
Query for fetching taxonomy categories by page using market context

Required permission is : READ-TAXONOMY-CATEGORIES
Response
Returns a TaxonomyCategoriesResult

Arguments
Name	Description
marketContext - MarketContextInput!	The market context under which the product should be listed.
paginationOptions - PaginationOptions	Generic specification for paginating through a list of items
Example
Query
query taxonomyCategories(
  $marketContext: MarketContextInput!,
  $paginationOptions: PaginationOptions
) {
  taxonomyCategories(
    marketContext: $marketContext,
    paginationOptions: $paginationOptions
  ) {
    pageInfo {
      page
      pageSize
      hasNextPage
      totalPages
    }
    taxonomyCategories {
      taxonomyCategoryId
      name
    }
  }
}
Variables
{
  "marketContext": {
    "brand": "WAYFAIR",
    "country": "UNITED_STATES",
    "locale": "en-US"
  },
  "paginationOptions": {
    "pageSize": 50,
    "page": 1
  }
}
Response
{
  "data": {
    "taxonomyCategories": {
      "pageInfo": {
        "page": 1,
        "pageSize": 50,
        "hasNextPage": true,
        "totalPages": 17
      },
      "taxonomyCategories": [
        {
          "taxonomyCategoryId": "7514",
          "name": "Shower Curtain Hooks and Accessories"
        },
        {
          "taxonomyCategoryId": "7515",
          "name": "Gift Cards for Physical Store"
        },
        {
          "taxonomyCategoryId": "7516",
          "name": "Teen Desk Chairs"
        },
        {
          "taxonomyCategoryId": "7517",
          "name": "Kids Cots"
        },
        {
          "taxonomyCategoryId": "7520",
          "name": "Pet Food Storage Containers & Treat Jars"
        }
      ]
    }
  }
}
Curl Command
Description
The following curl command demonstrates how to call the taxonomyCategories query.

Be sure to replace the placeholder {JWT token} with your actual JWT token.

Also replace the variables {locale}, {country}, {brand}, {page} and {pageSize} to actual values.

curl --location 'https://api.wayfair.io/v1/product-catalog-api/graphql' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {JWT Token}' \
--data '{"query":"query taxonomyCategories($marketContext: MarketContextInput!, $paginationOptions: PaginationOptions) { taxonomyCategories(marketContext: $marketContext, paginationOptions: $paginationOptions) { pageInfo { page pageSize hasNextPage totalPages } taxonomyCategories { taxonomyCategoryId name } } }","variables":{"marketContext":{"brand":xxxx,"country":xxxx,"locale":xxxx},"paginationOptions":{"page":xxxx,"pageSize":xxxxx}}}'
              
taxonomyCategories Sample Error
Description
This section demonstrates error scenarios for the taxonomyCategories Query, where the query fails for invaid data. The request uses the same query as the successful example, but with different variables. For more information about errors, click on this link.

Example - Server Error
Example Variables

{
  "marketContext": {
    "brand": "WAYFAIR",
    "country": "US",
    "locale": "en_US"
  },
  "page": 0,
  "pageSize": 100
}
Error Response

{
  "errors": [
    {
      "message": "catalog offerings errors were detected: Page Size must be a valid value >= 1",
      "extensions": {
        "category": "BAD_REQUEST"
      },
      "path": ["taxonomyCategories"]
    }
  ],
  "data": null
}
Fatal Errors
Description
If you receive one of the following errors, your request was not processed. Please fix the issue and re-submit the request.

User Message	Description
Access Denied	Client does not have the READ_TAXONOMY_CATEGORIES permission to query taxonomy categories.
Validation Errors
Description
If you receive one of the following errors, fix the invalid input and submit another request.

User Message	Description
Page Size must be a valid value [10, 20, 25, 50]	The pageSize parameter must be one of the allowed values: 10, 20, 25, or 50.
Page Size must be a valid value >= 1	The page parameter must be 1 or greater
Mutations
submit
Description
Initiates the product addition submission flow for a given supplierId. Up to 200 products are allowed. Proposed product additions should be grouped by marketContext and classId. For each product, answers must be provided for the questions fetched using the productAddition.questions query. For details about each input parameter, see the documentation for the SubmitProductAdditionsRequest type.

Returns an array of requestIds. Store them in your system and then input them into the productAddition.submissions query to retrieve status updates or errors.

Required permission is : WRITE-PRODUCT-ADDITION-SUBMIT
Response
Returns a SubmitProductAdditionsResponse!

Arguments
Name	Description
request - SubmitProductAdditionsRequest!	Encapsulates required and optional inputs for submitting product addition requests.
Example
Query
mutation submit($request: SubmitProductAdditionsRequest!) {
  productAddition {
    submit(request: $request) {
      requestIds
    }
  }
}
Variables
{
  "supplierId": 12345,
  "classId": 1227,
  "brandCatalog": "WAYFAIR_US"
}
Response
{
    "data": {
        "productAddition": {
            "submit": {
                "requestIds": [
                    "d4d1d80e-feaf-423f-bfdb-b5715b5cc9c8"
                ]
            }
        }
    }
}
Curl Command
Description
The following curl command demonstrates how to call the submit query.

Be sure to replace the placeholder {JWT token} with your actual JWT token.

Also replace the variables supplierId, locale, country, brand, classId, supplierPartNumber, questionId, answerId, textValue, proposedProductAdditions, marketContext, parts, answers and request to actual values.

curl --location 'https://api.wayfair.io/v1/product-catalog-api/graphql' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {JWT Token}' \
--data '{"query":"mutation submit($request: SubmitProductAdditionsRequest!) { productAddition { submit(request: $request) { requestIds } } }","variables":{"request":{"supplierId":"12345","proposedProductAdditions":[{"classId":xxxx,"marketContext":{"brand":xxxx,"country":xxxx,"locale":xxxx},"parts":[{"supplierPartNumber":xxxx,"answers":[{"questionId":xxxx,"answerId":xxxx},{"questionId":xxxx,"textValue":xxxx}]}]}]}}}'
submit Sample Error
Description
This section demonstrates error scenarios for the brandAssociations Query, where the query fails for invalid permission. The request uses the same query as the successful example, but with different variables. For more information about errors, click on this link.

Example - Server Error
Example Variables

{
  "request": {
    "supplierId": "12345",
    "proposedProductAdditions": [
      {
        "classId": 5041,
        "marketContext": {
          "brand": "WAYFAIR",
          "country": "US",
          "locale": "en_US"
        },
        "parts": []
      }
    ]
  }
}
Error Response

{
  "errors": [
    {
      "message": "Product Addition submission errors were detected: A product addition request was accepted without parts.",
      "extensions": {
        "category": "BAD_REQUEST"
      },
      "path": ["productAddition", "submit"]
    }
  ],
  "data": null
}
Fatal Errors
Description
If you receive one of the following errors, your request was not processed. Please fix the issue and re-submit the request.

User Message	Description
Access Denied	Client does not have the WRITE_SUBMISSIONS permission for the specified supplier.
Supplier [supplierId] has no users in Partner Home with the role to manage product addition	The supplier has no authorized users to process product additions.
Validation Errors
Description
If you receive one of the following errors, fix the invalid input and submit another request.

User Message	Description
A product addition request was accepted without parts	The parts array is empty or missing in the product addition request
The ClassId provided: '[classId]' is not valid	The specified classId does not exist or is not accessible
PartId '[partId]' has duplicated questions with ids [ [questionIds] ]	The same question has been answered multiple times for a single part
PartId '[partId]' has duplicated multi-choice selections for questionIds [ [questionIds] ]	The same multi-choice answer has been selected multiple times
PartId '[partId]' has unexpected questions with ids [ [questionIds] ]	Questions that are not applicable to the specified class have been included
A ProductPart has both manufacturerId and manufacturerName provided	Both manufacturerId and manufacturerName were provided; only one is allowed
Error in part with [fieldName]: '[value]'. 2 instances of [fieldName] found	The same field has been provided both as an optional input field and in the answers array
Types
Answer
Description
Encapsulates the details of a given answer to a product addition question.

Fields
Input Field	Description
questionId - String!	The questionId returned from the productAddition.questions query.
value - String!	The question answer represented as a string. It needs to conform to the data type specified by the QuestionAnswerType field in the ProductAdditionQuestion type.
parentRank - Int!	Applicable when providing multiple answers for a multi-value question (i.e., isMultiValue == true). Set the first answer to number 1, then increment for subsequent answers. Can be used in conjunction with rank. Default value = 1
rank - Int!	Applicable when providing multiple answers for a multi-choice question (i.e., QuestionAnswerType == MULTI_CHOICE). Set the first answer to number 1, then increment for subsequent answers. Can be used in conjunction with parentRank. Default value = 1
Example
{
  "questionId": "abc123",
  "value": "xyz789",
  "parentRank": 123,
  "rank": 987
}
Types
AttributesByFilterResult
Description
Return type for the TaxonomyAttributesByFilter query

Fields
Field Name	Description
taxonomyCategoryId - ID!	The ID of the taxonomy category to which all attributes belong
attributes - [TaxonomyAttribute]	All attributes of the category in the given market
conditionalityRules - [MarketAwareConditionalityData!]	List of "if-then" rules that define conditional logic between questions. For example, if "Material" (upstream) is answered as "Metal", then the "Wood Species" question (downstream) should automatically be answered as "Does Not Apply".
Example
{
  "taxonomyCategoryId": 4,
  "attributes": [TaxonomyAttribute],
  "conditionalityRules": [MarketAwareConditionalityData]
}
Types
AttributesFilterInput
Description
Input for querying taxonomy attributes by category and market

Fields
Input Field	Description
taxonomyCategoryId - ID!	The taxonomy category ID for retrieving taxonomy attributes.
marketContext - MarketContextInput!	The market context for retrieving taxonomy attributes.
Example
{
  "taxonomyCategoryId": "4",
  "marketContext": MarketContextInput
}
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

Refers to the brand name
JOSS_AND_MAIN

Refers to the brand name
PERIGOLD

Refers to the brand name
ALLMODERN

Refers to the brand name
BIRCHLANE

Refers to the brand name
Example
"WAYFAIR"
Types
CatalogEntityProperty
Description
All possible fields that can be updated on a catalog entity

Values
Enum Value	Description
ITEM_GROUP_NAME

Refers to the name field of the catalog item group
ITEM_GROUP_FEATURE_BULLETS

Refers to the featureBullets field of the catalog item group
ITEM_GROUP_MARKETING_COPY

Refers to the marketingCopy field of the catalog item group
ITEM_NAME

Refers to the name field of the catalog item
ITEM_TAXONOMY_ATTRIBUTES

Refers to the taxonomyAttributes field of the catalog item
ITEM_MEDIA

Refers to the media field of the catalog item
Example
"ITEM_GROUP_NAME"
Types
CatalogEntitySuccessfulUpdate
Description
Indicates what was successfully updated for a specific catalog item or item group

Fields
Field Name	Description
entityIdentifier - String!	The identifier of the catalog item or item group.
catalogEntityProperty - CatalogEntityProperty!	Catalog entity fields that were successfully updated
Example
{
  "entityIdentifier": "abc123",
  "catalogEntityProperty": "ITEM_GROUP_NAME"
}
Types
CatalogEntityUpdateProblem
Description
Problems that occurred when attempting to update a catalog item or item group

Fields
Field Name	Description
code - String	This is equivalent to the problem "type" field in the problem detail specification. Example: INVALID_INPUT
title - String	This indicates why the issue occurred. It is a short, human-readable summary of the problem type. Example: "Special characters such as !,@,#,$,% are not allowed"
detail - String	Human-readable explanation specific to this occurrence of the problem. Example: "The provided input contains special characters @ and !"
catalogEntityIdentifier - String	Entity identifier, i.e., catalog item or item group ID. Example:
catalogEntityProperty - CatalogEntityProperty	The catalog entity property that caused the problem. Example: ITEM_NAME
catalogEntityPropertyId - String	For catalog entity properties that have IDs associated with each field within the property (such as taxonomy attributes), this is used to identify which field within the property has an issue. Example (when the value provided for taxonomy attribute id: 1234 has a problem), this field will be "1234"
inputValue - String	The original input value that failed, represented as a string. Example: "Cl@rendon Sofa!"
Example
{
  "code": "abc123",
  "title": "xyz789",
  "detail": "xyz789",
  "catalogEntityIdentifier": "abc123",
  "catalogEntityProperty": "ITEM_GROUP_NAME",
  "catalogEntityPropertyId": "xyz789",
  "inputValue": "xyz789"
}
Types
CatalogEntityUpdateStatus
Description
Used to describe whether a request to update a catalog item or item group has been completed.

Values
Enum Value	Description
IN_PROGRESS

Update request is still being processed
COMPLETED

Update request has been completed. Note: COMPLETED does not necessarily mean fully successful; please check the Problems and SuccessfulUpdates fields
BLOCKED

Update request has been blocked
Example
"IN_PROGRESS"
Types
CountryInput
Values
Enum Value	Description
UNITED_STATES

U.S. catalog.
GERMANY

Updates to the German catalog are no longer allowed.
UNITED_KINGDOM

U.K. catalog.
CANADA

Updates to the Canadian catalog are no longer allowed.
Example
"UNITED_STATES"
Types
DownstreamCondition
Description
Downstream condition.

Fields
Field Name	Description
taxonomyAttributeId - String!	Question token.
operation - DownstreamOperation!	Upstream operation, such as equals, contains, does not contain, etc.
answers - [String]!	The answer value in string form.
validationType - DownstreamValidation	The answer value in string form.
Example
{
  "taxonomyAttributeId": "xyz789",
  "operation": "ASSIGN",
  "answers": ["xyz789"],
  "validationType": "ERROR"
}
Types
DownstreamOperation
Description
Possible downstream operation types.

Values
Enum Value	Description
ASSIGN

Assign the specified rules.
EXCLUDE

Exclude the specified rules.
Example
"ASSIGN"
Types
DownstreamValidation
Description
Downstream validation type

Values
Enum Value	Description
ERROR

Validation Error
WARNING

Validation Warning
Example
"ERROR"
Types
GetProductAdditionQuestionsRequest
Description
Encapsulates the input for the productAddition.questions query.

Fields
Input Field	Description
marketContext - MarketContextInput	The market context under which the product should be listed.
classId - Int!	The classId, used to identify and then return questions for a specific category.
Example
{"marketContext": MarketContextInput, "classId": 987}
Types
GetProductAdditionsRequest
Description
Encapsulates the required and optional inputs needed to fetch product addition requests.

Fields
Input Field	Description
supplierId - ID!	The supplierId. All proposed product additions will be associated with this supplierId.
ids - [ID!]!	Array of requestIds. These IDs will be returned from the productAddition.submit mutation.
Example
{"supplierId": "4", "ids": [4]}
Types
GetProductDescriptionByPartInput
Fields
Input Field	Description
supplierId - Int!	The supplier ID that the update is targeted at.
supplierPartNumbers - [String!]!	List of supplier parts mapped to SKUs
Example
{
  "supplierId": 987,
  "supplierPartNumbers": ["xyz789"]
}
Types
GetProductDescriptionByPartResponse
Fields
Field Name	Description
sku - String!	SKU associated with the supplier part number and market context
supplierPartNumbers - [String!]!	List of supplier parts mapped to SKUs
markets - [SkuMarketDescription!]!	List of market details mapped to SKU
Example
{
  "sku": "xyz789",
  "supplierPartNumbers": ["xyz789"],
  "markets": [SkuMarketDescription]
}
Types
GetSupplierBrandsAssociationsRequest
Description
Encapsulates the input for the productAddition.brandAssociations query.

Fields
Input Field	Description
supplierId - Int!	The supplierId associated with this brand association.
marketContext - MarketContextInput!	The market context associated with this brand association.
page - Int	The page number associated with this brand association.
pageSize - Int!	The page size associated with this brand association.
Example
{
  "supplierId": 987,
  "marketContext": MarketContextInput,
  "page": 987,
  "pageSize": 123
}
Types
GetSupplierBrandsAssociationsResponse
Description
Encapsulates the response to the productAddition.brandAssociations query.

Fields
Field Name	Description
brands - [SupplierBrandAssociation]	List of supplier brands associated with the supplier.
pageInfo - SupplierBrandPageInfo!	PageInfo containing page information response.
Example
{
  "brands": [SupplierBrandAssociation],
  "pageInfo": SupplierBrandPageInfo
}
Types
ID
Description
The ID scalar type represents a unique identifier, often used to refetch an object or as a key for a cache. The ID type is serialized as a String in JSON responses; however, it is not intended to be human-readable. When expected as an input type, any string (such as "4") or integer (such as 4) input value will be accepted as an ID.

Example
4
Types
Int
Description
The Int scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.

Example
987
Types
Manufacturer
Description
Encapsulates manufacturer details.

Fields
Field Name	Description
id - ID!	The unique identifier for the manufacturer.
name - String	The name of the manufacturer.
Example
{
  "id": "4",
  "name": "xyz789"
}
Types
MarketAwareConditionalityData
Description
Conditionality rules with tokens marked as upstream questions and their downstream conditions.

Fields
Field Name	Description
taxonomyAttributeId - String!	Question token
rules - [MarketAwareConditionalityRule!]!	Conditionality rules
Example
{
  "taxonomyAttributeId": "xyz789",
  "rules": [MarketAwareConditionalityRule]
}
Types
MarketAwareConditionalityRule
Description
Conditionality rules with a question tagged as upstream along with their downstream conditions.

Fields
Field Name	Description
upstreamCondition - UpstreamCondition!	Upstream conditions
downstreamConditions - [DownstreamCondition!]!	Downstream conditions
Example
{
  "upstreamCondition": UpstreamCondition,
  "downstreamConditions": [DownstreamCondition]
}
Types
MarketContext
Fields
Field Name	Description
locale - String	A locale encompasses a combination of language, territory, and code set used to identify a set of language conventions. It is represented by a code in the format "ll-CC", where "ll" is represented by ISO 639-1 (https://en.wikipedia.org/wiki/ISO_639-1) and "CC" is represented by ISO 3166-1 alpha-2 (https://www.iban.com/country-codes). Examples: en-US, en-GB, fr-CA, etc.
country - String	Unique country code ISO 3166-1 alpha-2 (https://www.iban.com/country-codes) used to represent the Wayfair market. Examples: US (United States), GB (United Kingdom)
brand - String	The Wayfair brand family is an intangible marketing or business concept that helps people identify the company or products. Examples: WF (Wayfair), JM (Joss & Main), PG (Perigold), AM (AllModern), BL (Birch Lane)
Example
{
  "locale": "abc123",
  "country": "xyz789",
  "brand": "abc123"
}
Types
MarketContextInput
Fields
Input Field	Description
locale - String	A locale encompasses a combination of language, territory, and code set used to identify a set of language conventions. It is represented by a code in the format "ll-CC", where "ll" is represented by ISO 639-1 (https://en.wikipedia.org/wiki/ISO_639-1) and "CC" is represented by ISO 3166-1 alpha-2 (https://www.iban.com/country-codes). Examples: en-US, en-GB, fr-CA, etc.
country - CountryInput	The country representing the Wayfair market.
brand - BrandInput	The Wayfair brand family is an intangible marketing concept that helps people identify the company or products.
Example
{
  "locale": "xyz789",
  "country": "UNITED_STATES",
  "brand": "WAYFAIR"
}
Types
MeasurementName
Values
Enum Value	Description
PRESSURE

Used when the attribute represents a pressure value
SPEED

Used when the attribute represents a speed or rate of movement
LENGTH

Used when the attribute represents a linear dimension
VOLUME

Used when the attribute represents the physical volume of an item or space
WEIGHT

Used when the attribute represents the weight or mass of a product.
TEMPERATURE

Used when the attribute represents a temperature value
SOUND

Used when the attribute represents sound level or loudness
ANGLE

Used when the attribute represents an angle or angular range
ELECTRICITY

Used when the attribute represents an electrical characteristic
TIME

Used when the attribute represents a time or duration
AGE

Used when the attribute represents age or recommended age
CAPACITY

Used when the attribute represents how much something can hold or support
POWER

Used when the attribute represents power output or consumption
BRIGHTNESS

Used when the attribute represents brightness or light output
DENSITY

Used when the attribute represents material density
Example
"PRESSURE"
Types
MeasurementUnit
Description
Unit for providing measurement information in taxonomy attribute values

Fields
Field Name	Description
name - String	Measurement unit name
symbol - String	The common symbol for this unit of measurement.
Example
{
  "name": "abc123",
  "symbol": "xyz789"
}
Types
MediaDocumentInput
Description
Media documents that can be associated with a product.

Fields
Input Field	Description
mediaDocumentType - MediaDocumentTypeInput!	You can provide this to indicate whether the media document is a DOCUMENT or LEGAL_DOCUMENT
documentUrl - Url!	The publicly accessible URL of the document.
documentTypes - [String!]!	Document types, must be one of the allowed types specified by the mediaMetadataTags query for DOCUMENT and LEGAL_DOCUMENT types.
regionType - String!	Region type, must be one of the allowed types specified by the mediaMetadataTags query for REGION type.
language - String!	Language, must be one of the allowed types specified by the mediaMetadataTags query for LANGUAGE type.
Example
{
  "mediaDocumentType": "DOCUMENT",
  "documentUrl": Url,
  "documentTypes": ["abc123"],
  "regionType": "xyz789",
  "language": "xyz789"
}
Types
MediaDocumentTypeInput
Description
Whether the media document type in the answer is DOCUMENT or LEGAL_DOCUMENT

Values
Enum Value	Description
DOCUMENT

A general media document.
LEGAL_DOCUMENT

A legally binding or compliance document.
Example
"DOCUMENT"
Types
MediaInput
Description
All media associated with a product.

Fields
Input Field	Description
images - [Url!]	The URL of the publicly accessible image.
videos - [Url!]	The URL of the publicly accessible video.
documents - [MediaDocumentInput!]	Documents that should be associated with the product.
Example
{
  "images": [Url],
  "videos": [Url],
  "documents": [MediaDocumentInput]
}
Types
MediaMetaDataTag
Description
Media metadata tag

Fields
Field Name	Description
metaDataId - ID!	The ID of the media metadata tag
name - String!	Media metadata name
Example
{
  "metaDataId": "4",
  "name": "abc123"
}
Types
MediaMetaDataTagInput
Description
Media metadata tag input filter

Fields
Input Field	Description
metaDataTagTypes - [MediaMetaDataTagTypeInput!]!	The media metadata tag type that should be received (e.g., document type, legal document type, language type, region type)
marketContext - MarketContextInput!	Market context.
Example
{
  "metaDataTagTypes": ["DOCUMENT"],
  "marketContext": MarketContextInput
}
Types
MediaMetaDataTagSet
Description
Media metadata tag set

Fields
Field Name	Description
metaDataTagType - String!	Media metadata tag type, such as document type, legal document type, language type, region type
metaDataTags - [MediaMetaDataTag!]!	Metadata tags
Example
{
  "metaDataTagType": "abc123",
  "metaDataTags": [MediaMetaDataTag]
}
Types
MediaMetaDataTagTypeInput
Description
Media metadata tag type, such as document type, legal document type, language type, region type

Values
Enum Value	Description
DOCUMENT

A general media document.
LEGAL_DOCUMENT

A legally binding or compliance document.
LANGUAGE

Language-specific document.
REGION

Region-specific document.
Example
"DOCUMENT"
Types
MediaType
Description
Media types supported by Wayfair

Values
Enum Value	Description
IMAGE

Media represents an image, allowed file extensions are: png, jpg, jpeg
VIDEO

Media represents a video, allowed file extensions are: mp4, mov, wmv
DOCUMENT

Media represents a PDF document, must have file extension: pdf.
Example
"IMAGE"
Types
OperationStatus
Description
Status indicating whether an operation has results, succeeded, or failed.

Values
Enum Value	Description
SUCCEEDED

Status Indicator
FAILED

Status Indicator
Example
"SUCCEEDED"
Types
PaginationInfo
Description
Meta information about pagination

Fields
Field Name	Description
page - Int!	The page number of taxonomy categories to be returned. The first page is 1.
pageSize - Int!	The number of requested taxonomy categories that will be returned per page. This value can be one of the following: 10, 20, 25, 50.
hasNextPage - Boolean!	Whether the current pagination selection has a next page.
totalPages - Int!	The total number of pages the current dataset and pagination selection can display.
Example
{"page": 123, "pageSize": 987, "hasNextPage": true, "totalPages": 123}
Types
PaginationOptions
Description
Generic specification for paginating through a list of items

Fields
Input Field	Description
page - Int	The page number of the taxonomy categories that will be returned. The first page is 1.
pageSize - Int	The requested number of taxonomy categories that will be returned per page. This value can be one of these: 10, 20, 25, 50.
Example
{"page": 123, "pageSize": 123}
Types
PossibleAnswer
Description
Possible answers to product addition questions which must be answered from a list of possibilities.

Fields
Field Name	Description
key - String	An identifier, suitable for use as key in a UI "pick list" component.
value - String	The answer's value. THIS is the value which must ultimately be supplied when answer questions with the productAddition.submit mutation.
Example
{
  "key": "abc123",
  "value": "abc123"
}
Types
ProblemDetail
Description
Provides human and machine readable details about issues that occur when making an API call, along with any additional context about where the error happened. This largely conforms to the ProblemDetail specification RFC 9457 (formerly 7807) https://www.rfc-editor.org/rfc/rfc9457.html

Fields
Field Name	Description
code - String	This is equivalent to the problem "type" field in the problem detail specification. It represents the type of problem encountered. Example: INVALID_INPUT
title - String	This indicates why the issue occurred. It is a short, human-readable summary of the problem type. Example: "Special characters such as !,@,#,$,% are not allowed"
detail - String	Human-readable explanation specific to this occurrence of the problem. Example: "The provided input contains special characters @ and !"
Possible Types
ProblemDetail Types
CatalogEntityUpdateProblem

Example
{
  "code": "xyz789",
  "title": "abc123",
  "detail": "xyz789"
}
Types
ProductAddition
Description
Encapsulates details for a given product addition request.

Fields
Field Name	Description
requestId - ID!	The requestId of the product addition request in need of remediation. This id would've been returned from the productAddition.submit mutation.
supplierId - ID!	The supplierId associated with this product addition request.
supplierPartNumber - String	The supplierPartNumber associated with this product addition request.
classId - Int!	The classId associated with this product addition request. It determined which class specific questions were presented for answering during the product addition process.
marketContext - MarketContext	The market context for which the product should be listed under.
partId - Int	The partId associated with this product addition request. No longer supported
partType - Int	The partType associated with this product addition request. No longer supported
status - ProductAdditionStatus!	The current status the associated product addition request. Refer to the syndication documentation for the order of progression.
validationStatus - OperationStatus	The success or failure status of the validation step for this product addition process.
submissionStatus - OperationStatus	The success or failure status of the submission step for this product addition process.
validationFlaws - [ValidationFlaw]	An array of validation flaws in need of remediation. Successfully remediated flaws will be removed from this array. The number of flaws must be reduced to zero before the addition process for this product is allowed to resume.
Example
{
  "requestId": 4,
  "supplierId": "4",
  "supplierPartNumber": "abc123",
  "classId": 123,
  "marketContext": MarketContext,
  "partId": 123,
  "partType": 123,
  "status": "VALIDATING",
  "validationStatus": "SUCCEEDED",
  "submissionStatus": "SUCCEEDED",
  "validationFlaws": [ValidationFlaw]
}
Types
ProductAdditionQuestion
Description
Encapsulates details for a given product addition question.

Fields
Field Name	Description
id - String!	The question id, referred to as questionId in other areas of the production addition API.
parentId - String	The question's parentId, if it is a child question. No longer supported
internalName - String!	The question's "internal" name. Suitable for use as a variable name in a programming language. No longer supported
displayName - String!	The question's human-readable name. Suitable for display on a UI as a field label.
answerType - QuestionAnswerType	The question's answer type.
isActive - Boolean!	Whether the question is active.
isMultiValue - Boolean!	Whether the question is multi-valued.
childQuestions - [ProductAdditionQuestion!]!	An array of child questions. When applicable, the parent question is considered a container question, so no need to directly answer it.
possibleAnswers - [PossibleAnswer!]!	An array of allowable answers for this question, if applicable, when the answerType is suffixed with "_CHOICE".
importanceType - QuestionImportanceType	A type which designates the question as optional, required, or conditional.
isNotApplicableEligible - Boolean	Whether the question is eligible for being not applicable.
isUnavailableEligible - Boolean	Whether the question is eligible for being unavailable.
description - String	Description of the question
isCustomEligible - Boolean	Whether the question is eligible to be assigned a custom enum value (if applicable).
Example
{
  "id": "xyz789",
  "parentId": "abc123",
  "internalName": "xyz789",
  "displayName": "abc123",
  "answerType": "DECIMAL",
  "isActive": false,
  "isMultiValue": true,
  "childQuestions": [ProductAdditionQuestion],
  "possibleAnswers": [PossibleAnswer],
  "importanceType": "OPTIONAL",
  "isNotApplicableEligible": false,
  "isUnavailableEligible": true,
  "description": "xyz789",
  "isCustomEligible": true
}
Types
ProductAdditionStatus
Description
Statuses for the product addition submission. Refer to the syndication documentation for the order of progression.

Values
Enum Value	Description
VALIDATING

Submission is being validated.
VALIDATED

Validation completed successfully.
SUBMITTING

Submission is being sent for processing.
SUBMITTED

Submission has been accepted.
PROCESSING

Submission is being processed.
LIVE

Not currently supported
Example
"VALIDATING"
Types
ProductDescriptionInput
Description
Product descriptions are shared at the group level (SKU) within Wayfair.

Fields
Input Field	Description
supplierPartNumbers - [String!]!	
The set of supplier part numbers that should have the same marketing copy and feature bullet changes applied.

It is important to note that descriptions are not defined at the supplier part number and instead are applied at the internal grouping (SKU) level. Therefore, the parts specified below may affect one or more groups which could affect more parts than are provided in the set. It is also important to know that parts can be included in multiple groups.

Here are examples of expected behaviors:

Given group SKU_1 has PART_1 and PART_2 and only PART_1 was provided then descriptions on site would also apply to PART_2.
Given PART_1 belongs to both group SKU_1 and SKU_2 then updates to PART_1 would apply the description to both SKU_1 and SKU_2 on site.
marketingCopy - String	
The marketing copy that describes the product details.

If an empty string or null value is provided then:

At least three feature bullets are required for the product
Any existing marketing copy will be removed
featureBullets - [String!]	
The feature bullets for the product in the order that should be displayed on site.

If an empty list or null value is provided then:

The marketing copy is required for the product
Any existing feature bullets will be removed
If the set of bullets is less than three then:

The marketing copy is required for the product
Any feature bullet that exists but is not in the set provided will be removed
If the set of bullets has three or more then:

Any feature bullet that exists but is not in the set provided will be removed
Example
{
  "supplierPartNumbers": ["abc123"],
  "marketingCopy": "abc123",
  "featureBullets": ["abc123"]
}
Types
ProductPartWithAnswers
Description
An association of partId to answered questions for the given part.

Fields
Input Field	Description
manufacturerId - ID	
Optional ManufacturerId that corresponds to a manufacturer brand. You can provide this instead of answering the 'core::manufacturerId' question.

Note: Both ManufacturerId and ManufacturerName cannot be provided, only one of them can be provided at a time.

manufacturerName - String	
Optional ManufacturerName that corresponds to a manufacturer brand. You can provide this instead of giving an input for the ManufacturerId.

Note: Both ManufacturerId and ManufacturerName cannot be provided, only one of them can be provided at a time.

supplierPartNumber - String	The part number that represents the supplier's product. You can provide this in place of answering the 'core::supplierPartNumber' question
answers - [Answer!]!	An array of answers to given questions, as identified by the question's id.
ignoreWarnings - Boolean	After the product addition request is accepted, it is submitted for validation. This validation process may result in validation flaws, which will need manual correction using our remediation mutation. Flaws can be of type ERROR or WARNING, remediation is required for the former and optional for the latter. If validation yields only flaws of type WARNING, setting this flag to "true" causes this part addition request to proceed despite warnings. Otherwise, warnings will need to be manually remediated. This flag overrides the same one set at the SubmitProductAdditionsRequest object level. If not provided, defaults to false.
amazonStandardIdentificationNumber - String	You can provide this in place of answering the 'core::amazonStandardIdentificationNumber' question
collectionName - String	You can provide this in place of answering the 'core::collectionName' question
manufacturerPartNumber - String	You can provide this in place of answering the 'core::manufacturerPartNumber' question
manufacturerProductUrl - String	You can provide this in place of answering the 'core::manufacturerProductUrl' question
productName - String	You can provide this in place of answering the 'core::productName' question
universalProductCode - String	You can provide this in place of answering the 'core::universalProductCode' question
featureBullets - [String!]	You can provide this in place of answering the 'featureDescription::genericFeatures' question
media - MediaInput	All the media that is related to the new product being added.
marketingCopy - String	You can provide this in place of answering the 'featureDescription::romanceCopy' question
Example
{
  "manufacturerId": 4,
  "manufacturerName": "abc123",
  "supplierPartNumber": "xyz789",
  "answers": [Answer],
  "ignoreWarnings": true,
  "amazonStandardIdentificationNumber": "abc123",
  "collectionName": "abc123",
  "manufacturerPartNumber": "abc123",
  "manufacturerProductUrl": "abc123",
  "productName": "xyz789",
  "universalProductCode": "xyz789",
  "featureBullets": ["abc123"],
  "media": MediaInput,
  "marketingCopy": "abc123"
}
Types
ProductUpdateDescriptionStatus
Description
Status of the product description update.

Values
Enum Value	Description
UNKNOWN

Update for the requested transaction ID was not found
RECEIVED

Update has been received.
PROCESSING

Update is currently being processed.
REJECTED

Update was rejected.
PROCESSED

Update has completed processing.
Example
"UNKNOWN"
Types
QuestionAnswerType
Description
Allowed data types for product addition question answers.

Values
Enum Value	Description
DECIMAL

A numeric value with decimals.
BOOLEAN

A true or false value
SINGLE_CHOICE

A single selectable option from a list.
INTEGER

A whole number value.
MULTI_CHOICE

Multiple selectable options from a list.
STRING

A free-text value.
ENUM

A value selected from predefined options.
Example
"DECIMAL"
Types
QuestionImportanceType
Description
Possible types for question importance.

Values
Enum Value	Description
OPTIONAL

Designates a question as being optional, for product addition purposes.
REQUIRED

Designates a question as being required, for product addition purposes.
CONDITIONAL

Denotes the correctness of the response to this question as being dependent on another question.
RECOMMENDED

Designates a question as being recommended, for product addition purposes.
Example
"OPTIONAL"
Types
SkuMarketDescription
Fields
Field Name	Description
marketContext - MarketContext!	The market context associated with this product description.
isDescriptionUpdatable - Boolean!	Indicates whether the marketing copy and feature bullets for this marketing context can be updated
marketingCopy - String	The marketing copy associated with the SKU
featureBullets - [String!]	The list of feature bullets associated with the SKU
Example
{
  "marketContext": MarketContext,
  "isDescriptionUpdatable": true,
  "marketingCopy": "abc123",
  "featureBullets": ["abc123"]
}
Types
StatusOfUpdateRequestInput
Description
Input required to get the status of a request to update catalog entities (items, item groups)

Fields
Input Field	Description
requestId - String!	The requestId of the update operation whose status is being queried
supplierId - String!	The supplier ID that fulfills the catalog entity being updated
Example
{
  "requestId": "xyz789",
  "supplierId": "abc123"
}
Types
String
Description
The String scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.

Example
"xyz789"
Types
SubmitProductAdditionRequest
Description
Encapsulates details for a given product addition submission request.

Fields
Input Field	Description
classId - Int!	The classId associated with this product addition request. It determined which class specific questions were presented for answering during the product addition process.
marketContext - MarketContextInput	The market context associated with this product.
parts - [ProductPartWithAnswers!]!	An array of associations of partIds to answered questions for this product addition request. A maximum of 100 products (ProductPartWithAnswers) are allowed.
Example
{
  "classId": 987,
  "marketContext": MarketContextInput,
  "parts": [ProductPartWithAnswers]
}
Types
SubmitProductAdditionsRequest
Description
Encapsulates required and optional inputs for submitting product addition requests.

Fields
Input Field	Description
supplierId - ID!	The supplierId. All proposed product additions will be associated with this supplierId.
proposedProductAdditions - [SubmitProductAdditionRequest!]!	An array of product addition requests. A maximum of 100 products (proposedProductAdditions) are allowed.
ignoreWarnings - Boolean	After the product addition request is accepted, it is submitted for validation. This validation process may result in validation flaws, which will need manual correction using our remediation mutation. Flaws can be of type ERROR or WARNING, remediation is required for the former and optional for the latter. If validation yields only flaws of type WARNING, setting this flag to "true" causes ALL addition requests to proceed despite warnings. Otherwise, warnings will need to be manually remediated. This flag can also be set for each individual ProductPartWithAnswers object, which effectively overrides it at this level. If not provided, defaults to false. Default = false
rejectAllOnErrors - Boolean	If true then when one product part encounters errors the entire request will be rejected so that the issues can be corrected so that products can be sent together as a bundle. This is important so that product parts that are variants of each other can be properly grouped together and not be split apart. Default = false
Example
{
  "supplierId": 4,
  "proposedProductAdditions": [
    SubmitProductAdditionRequest
  ],
  "ignoreWarnings": true,
  "rejectAllOnErrors": true
}
Types
SubmitProductAdditionsResponse
Description
Encapsulates the response details for a given SubmitProductAdditionsRequest.

Fields
Field Name	Description
requestIds - [ID!]!	Array of requestIds. Store them in your system, then input them into the productAddition.submissions query for status updates or errors.
Example
{"requestIds": [4]}
Types
SupplierBrandAssociation
Description
Brand details associated with a supplier.

Fields
Field Name	Description
id - ID!	The unique identifier for the supplier brand.
manufacturer - Manufacturer!	The manufacturer associated with this brand.
Example
{"id": 4, "manufacturer": Manufacturer}
Types
SupplierBrandPageInfo
Description
Encapsulates pageInfo details.

Fields
Field Name	Description
hasNextPage - Boolean!	hasNextPage, true if there is one.
hasPreviousPage - Boolean!	hasPreviousPage, true if there is one.
totalPages - Int!	totalPages, the total number of pages.
Example
{"hasNextPage": false, "hasPreviousPage": false, "totalPages": 123}
Types
TaxonomyAttribute
Description
Attributes define the properties (e.g. color, size) assigned to products in a given category (e.g. pillows). Each attribute will detail requirements for its value(s), such as whether they are required or optional, the data type it represents (e.g. string, integer), and any possible values that can be chosen from.

Fields
Field Name	Description
taxonomyAttributeId - ID!	The ID of this attribute
title - String!	The human readable name of this taxonomy attribute. Examples: Pillow Shape, Fabric Pattern, Battery Type
description - String	An explanation of what this attribute represents
market - MarketContext	The market in which this attribute is relevant. Some attributes are only relevant in certain market contexts, i.e. attributes providing certifications such as California Prop 65
requirement - TaxonomyAttributeRequirement!	Designates whether this attribute is required or not, and how important it is
valueFormat - TaxonomyAttributeValueFormat!	Information about the data type that is expected for this attribute's value(s)
possibleAttributeValues - [TaxonomyAttributePossibleValue]	
Pre-defined possible values that can be provided for this attribute to describe the catalog entity. Notes:

if the attribute's value is eligible for being set as not applicable, then "Does Not Apply" will be a value in this list.
if the attribute's value is eligible for being marked as data is unavailable, then "Unavailable" will be a value in this list
parentAttributeId - String	The parent attribute of this attribute
childAttributes - [TaxonomyAttribute]	Child attributes. Supports one level of nesting.
relatedAttributeIds - [String!]	
The group of attributes that are related based on conditionality requirement rules. When updating a given attribute, you must also include all of the related attributes as part of the request.

Example: Given a related attribute ID set of [1, 2, 3] when an update to ID 1 is requested, the existing values for 2 and 3 must also be included as part of the update.

taxonomyCategoryIds - [ID!]!	The list of categories that this taxonomy attribute is used for. A catalog entity must be in one of these categories in order for this attribute to be applied to it.
Example
{
  "taxonomyAttributeId": 4,
  "title": "xyz789",
  "description": "abc123",
  "market": MarketContext,
  "requirement": "OPTIONAL",
  "valueFormat": TaxonomyAttributeValueFormat,
  "possibleAttributeValues": [
    TaxonomyAttributePossibleValue
  ],
  "parentAttributeId": "abc123",
  "childAttributes": [TaxonomyAttribute],
  "relatedAttributeIds": ["abc123"],
  "taxonomyCategoryIds": [4]
}
Types
TaxonomyAttributeMeasurement
Description
This type will be used if a taxonomy attribute is intended to provide measurement data about a catalog entity (i.e. weight, brightness, temperature, etc.).

Fields
Field Name	Description
measurementName - MeasurementName	The human-readable name of this measurement
measurementUnit - MeasurementUnit	The unit type used to represent this measurement
Example
{
  "measurementName": "PRESSURE",
  "measurementUnit": MeasurementUnit
}
Types
TaxonomyAttributePossibleValue
Description
Pre-defined possible values that can be provided for a taxonomy attribute to describe a catalog entity.

Fields
Field Name	Description
value - String!	The actual value that can be provided for a taxonomy attribute to help describe a catalog entity. Example: For taxonomy attribute Pillow Type, possible values could be "Round" or "Rectangular", etc.
definition - String	Explanation of what this possible value represents
Example
{
  "value": "xyz789",
  "definition": "xyz789"
}
Types
TaxonomyAttributeRequirement
Description
Indicates whether a taxonomy attribute is required for a catalog entity.

Values
Enum Value	Description
OPTIONAL

The taxonomy attribute is optional.
REQUIRED

The taxonomy attribute is required.
RECOMMENDED

The taxonomy attribute is not required, but recommended.
Example
"OPTIONAL"
Types
TaxonomyAttributeValueDatatype
Description
Allowed data types for assigning values to taxonomy attributes.

Values
Enum Value	Description
BOOLEAN

True or False
STRING

A single word
INTEGER

Integer
DECIMAL

Floating point number
SINGLE_CHOICE

Single selection only
MULTI_CHOICE

Multiple options can be selected
Example
"BOOLEAN"
Types
TaxonomyAttributeValueFormat
Description
Information about the expected data type and structure of taxonomy attribute values

Fields
Field Name	Description
canValueBeCustomized - Boolean	Indicates whether the value can be a custom value not listed under possible attribute values.
canValueBeSetToUnavailable - Boolean	Indicates whether the value can be set to Unavailable in cases where the supplier did not get this information from the manufacturer. If true, the possible values list will include "Unavailable"
canValueBeSetToNotApplicable - Boolean	Indicates whether the value can be set to Does Not Apply (N/A) in cases where the attribute is not relevant. If true, the possible values list will include "Does Not Apply"
datatype - TaxonomyAttributeValueDatatype	When a string value is provided for this taxonomy attribute, it will be converted to this type in our system; therefore, the provided string must be convertible to this data type (unless the selected value is "Does Not Apply" or "Unavailable").
measurement - TaxonomyAttributeMeasurement	Will be used when the attribute is intended to provide information about a given measurement, for example: Weight = 10 kg
Example
{
  "canValueBeCustomized": false,
  "canValueBeSetToUnavailable": true,
  "canValueBeSetToNotApplicable": false,
  "datatype": "BOOLEAN",
  "measurement": TaxonomyAttributeMeasurement
}
Types
TaxonomyCategoriesResult
Description
Page representing taxonomy categories

Fields
Field Name	Description
pageInfo - PaginationInfo	Meta information about pagination
taxonomyCategories - [TaxonomyCategory!]!	List of taxonomy categories being returned
Example
{
  "pageInfo": PaginationInfo,
  "taxonomyCategories": [TaxonomyCategory]
}
Types
TaxonomyCategory
Description
Taxonomy categories group similar products sold together on the Wayfair main site and specialty retail brand sites (such as AllModern, Birch Lane, etc.).

Each category in a given market will share similar attributes, for example:

Taxonomy Category: Pillow Taxonomy Attribute: Pillow Shape; Taxonomy Attribute Values: [Rectangle, Square, Round]

Fields
Field Name	Description
taxonomyCategoryId - ID!	Identifies the taxonomy category
name - String	The name of this taxonomy category
Example
{
  "taxonomyCategoryId": "4",
  "name": "abc123"
}
Types
UpdateAttributeInput
Description
Used to indicate how and which attribute of the catalog entity to update

Fields
Input Field	Description
attributeId - String!	The attribute ID for which a new value is being set (formerly called Question Id)
value - [String!]!	The new value of the attribute.
Example
{
  "attributeId": "abc123",
  "value": ["xyz789"]
}
Types
UpdateCatalogEntityResponse
Description
When requesting an update to a catalog item or item group, a response containing a request ID will be sent. This request ID can be used with the statusOfUpdateRequest query to check the status of the update request

Fields
Field Name	Description
requestId - String!	The ID representing the update change request
Example
{"requestId": "abc123"}
Types
UpdateCatalogEntityTaxonomyAttributesInput
Description
Attributes for updating a catalog item

Fields
Input Field	Description
updates - [UpdateAttributeInput!]!	All attribute updates for the item
ignoreWarnings - Boolean	Indicates that attribute values will be updated regardless of whether any validation warnings exist. Validation errors will still prevent the update. Default = false
enableAutofill - Boolean	When set to true, upon saving, any blank values will first be auto-populated if possible, then validated, then saved. Default = false
taxonomyCategoryId - String!	The ID of the taxonomy category to which all attributes belong
Example
{
  "updates": [UpdateAttributeInput],
  "ignoreWarnings": true,
  "enableAutofill": false,
  "taxonomyCategoryId": "abc123"
}
Types
UpdateCatalogItemGroupInput
Description
The catalog item group to update and the changes being requested

Fields
Input Field	Description
itemGroupId - String!	The ID of the catalog item group to update
itemGroupName - String	Optional input: The new name for this catalog item group
marketingCopy - String	Optional input: The new marketing copy for this catalog item group
featureBullets - [String!]	Optional input: The new feature bullets for this catalog item group
Example
{
  "itemGroupId": "xyz789",
  "itemGroupName": "abc123",
  "marketingCopy": "xyz789",
  "featureBullets": ["xyz789"]
}
Types
UpdateCatalogItemInput
Description
The catalog item to update and the changes being requested

Fields
Input Field	Description
supplierPartNumber - String!	The ID of the catalog item to update
itemName - String	Optional input: The new name for this catalog item
attributes - UpdateCatalogEntityTaxonomyAttributesInput	Optional input: The new taxonomy attribute values for this catalog item
Example
{
  "supplierPartNumber": "xyz789",
  "itemName": "xyz789",
  "attributes": UpdateCatalogEntityTaxonomyAttributesInput
}
Types
UpdateCatalogItemMediaInput
Fields
Input Field	Description
supplierPartNumber - String!	The supplier part number that identifies the catalog item.
mediaUrl - Url!	The public URL where the media is accessible. This is used for uploading new media and identifying existing media to which operations should be applied.
mediaType - MediaType!	The media type.
leadImageOverride - Boolean	
This is optional for media of type image that already exists and meets the hero image eligibility criteria.

If this field is set to true for a new image that is not in our system, the override will be ignored.
If the image is already in our system and has met the hero eligibility requirements, setting this to true will override the default behavior of Wayfair selecting which hero image to display, forcing this image to always be the displayed hero image.
If set to false, any previous overrides will be removed and hero image selection will revert to Wayfair's default hero image selection behavior.
Example
{
  "supplierPartNumber": "abc123",
  "mediaUrl": Url,
  "mediaType": "IMAGE",
  "leadImageOverride": true
}
Types
UpdateCatalogItemsMediaInput
Description
Input required to update catalog item media

Fields
Input Field	Description
supplierId - String!	The supplier ID that fulfills these catalog items
catalogItemsToUpdate - [UpdateCatalogItemMediaInput!]!	The media changes being requested and for which catalog items
validateOnly - Boolean!	When set to true, validates the input changes but does not actually perform the update itself. When set to false, validation will still run, and for any successful validations, the update will be performed.
Example
{
  "supplierId": "abc123",
  "catalogItemsToUpdate": [UpdateCatalogItemMediaInput],
  "validateOnly": false
}
Types
UpdateMarketSpecificCatalogItemGroupsInput
Description
Input required to update catalog item groups for a specific market

Fields
Input Field	Description
supplierId - String!	The supplier ID that fulfills these item groups
marketContext - MarketContextInput!	The market context in which catalog item groups will be updated
catalogItemGroupsToUpdate - [UpdateCatalogItemGroupInput!]!	The actual changes being requested and for which catalog item groups
validateOnly - Boolean!	When set to true, validates the input changes but does not actually perform the update itself. When set to false, validation will still run, and for any successful validations, the update will be performed.
Example
{
  "supplierId": "abc123",
  "marketContext": MarketContextInput,
  "catalogItemGroupsToUpdate": [
    UpdateCatalogItemGroupInput
  ],
  "validateOnly": true
}
Types
UpdateMarketSpecificCatalogItemsInput
Description
Input required to update catalog items for a specific market

Fields
Input Field	Description
supplierId - String!	The supplier ID that fulfills these catalog items
marketContext - MarketContextInput!	The market context in which items will be updated
catalogItemsToUpdate - [UpdateCatalogItemInput!]!	The actual changes being requested and for which catalog items
validateOnly - Boolean!	When set to true, validates the input changes but does not actually perform the update itself. When set to false, validation will still run, and for any successful validations, the update will be performed.
Example
{
  "supplierId": "xyz789",
  "marketContext": MarketContextInput,
  "catalogItemsToUpdate": [UpdateCatalogItemInput],
  "validateOnly": true
}
Types
UpdateProductDescriptionDuplicateSkuUpdate
Fields
Field Name	Description
skus - [String!]!	The SKU to which multiple supplier part numbers map
supplierPartNumbers - [String!]!	The set of supplier part numbers that map to the associated SKU
Example
{
  "skus": ["abc123"],
  "supplierPartNumbers": ["xyz789"]
}
Types
UpdateProductDescriptionError
Fields
Field Name	Description
index - Int!	Index corresponding to the position of the requested update (starting from 1)
code - String!	
Code identifying the error type

Example: CAT-UPDPRDDESC-400 (validation warning), CAT-UPDPRDDESC-500 (internal server error)

message - String!	Friendly message describing the error encountered
duplicateSkuUpdate - UpdateProductDescriptionDuplicateSkuUpdate	Errors encountered when submitting part number updates that map to the same SKU
Example
{
  "index": 123,
  "code": "abc123",
  "message": "xyz789",
  "duplicateSkuUpdate": UpdateProductDescriptionDuplicateSkuUpdate
}
Types
UpdateProductDescriptionGroupError
Fields
Field Name	Description
code - String!	
Code identifying the error type

Example: CAT-UPDPRDDESC-400 (validation warning), CAT-UPDPRDDESC-500 (internal server error)

message - String!	Friendly message describing the error encountered
Example
{
  "code": "xyz789",
  "message": "xyz789"
}
Types
UpdateProductDescriptionGroupResponse
Fields
Field Name	Description
sku - String!	The SKU name representing the grouping of supplier parts that were updated
supplierPartNumbers - [String!]!	The supplier parts in the group that were updated
result - UpdateProductDescriptionGroupResult!	The action taken related to the product group change request
errors - [UpdateProductDescriptionGroupError]!	Errors encountered when the update result fails
Example
{
  "sku": "abc123",
  "supplierPartNumbers": ["abc123"],
  "result": "SKIPPED",
  "errors": [UpdateProductDescriptionGroupError]
}
Types
UpdateProductDescriptionGroupResult
Description
Results related to product group updates.

Values
Enum Value	Description
SKIPPED

Update was skipped because the description is already in the desired state
SUCCESS

Update was successfully applied
FAILED

Update application failed
Example
"SKIPPED"
Types
UpdateProductDescriptionInput
Description
Updates that can be applied in bulk.

Fields
Input Field	Description
supplierId - Int!	The supplier ID that the update targets.
marketContext - MarketContextInput!	The marketContext associated with this product.
updates - [ProductDescriptionInput!]!	The updates that will be applied, with no guarantee of the order of execution for each.
Example
{
  "supplierId": 987,
  "marketContext": MarketContextInput,
  "updates": [ProductDescriptionInput]
}
Types
UpdateProductDescriptionResponse
Fields
Field Name	Description
transactionId - String!	The transaction ID that can be associated with the initial request.
success - Boolean!	
Indicates whether the update was successfully received.

If true, the status details of the transaction can be queried via the transaction ID. If false, any additional error details will be provided.

errors - [UpdateProductDescriptionError]!	Errors encountered when the update was not successfully received upon submission.
Example
{
  "transactionId": "abc123",
  "success": false,
  "errors": [UpdateProductDescriptionError]
}
Types
UpdateProductDescriptionStatusRequest
Fields
Input Field	Description
supplierId - Int!	The supplier ID that the update targets.
transactionId - String!	The transaction ID associated with the update.
Example
{
  "supplierId": 123,
  "transactionId": "xyz789"
}
Types
UpdateProductDescriptionStatusResponse
Fields
Field Name	Description
transactionId - String!	The transaction ID that can be associated with the update.
status - ProductUpdateDescriptionStatus!	
The current status of the associated product update description request.

During the update request, if any basic validation rules are violated, the status will initially be set to RECEIVED state or REJECTED state.

From the RECEIVED state, as updates are attempted, it will transition to the PROCESSING state. If any business rules are violated, the entire update will terminate and the status will be set to REJECTED.

Otherwise, from the PROCESSING state, it will transition to the final PROCESSED state, and result details will be provided in the update group response.

updatedGroups - [UpdateProductDescriptionGroupResponse!]!	Groups that have been updated when the request is in PROCESSED state.
errors - [UpdateProductDescriptionError]!	Errors encountered when the update is in REJECTED state.
Example
{
  "transactionId": "xyz789",
  "status": "UNKNOWN",
  "updatedGroups": [
    UpdateProductDescriptionGroupResponse
  ],
  "errors": [UpdateProductDescriptionError]
}
Types
UpdateRequestStatus
Description
Represents the status of the update request.

Fields
Field Name	Description
requestId - String!	Unique identifier of the requested update operation
validationOnly - Boolean!	If true, indicates that no update occurred; only input was validated, and allSucceeded refers to validation success.
status - CatalogEntityUpdateStatus!	Status of the catalog item groups being requested
problems - [CatalogEntityUpdateProblem!]!	Any handled errors that occurred during this update will be listed here. Note that a single catalog entity may have multiple problems. If all succeeded, this will be empty.
successfulUpdates - [CatalogEntitySuccessfulUpdate]	List of catalog entities that were successfully updated
Example
{
  "requestId": "abc123",
  "validationOnly": true,
  "status": "IN_PROGRESS",
  "problems": [CatalogEntityUpdateProblem],
  "successfulUpdates": [CatalogEntitySuccessfulUpdate]
}
Types
UpstreamCondition
Description
Upstream condition。

Fields
Field Name	Description
taxonomyAttributeId - String!	Question token.
operation - UpstreamOperation!	Upstream operation, such as equals, contains, does not contain, etc.
answers - [String]!	The answer value in string form.
Example
{
  "taxonomyAttributeId": "abc123",
  "operation": "EQUALS",
  "answers": ["xyz789"]
}
Types
UpstreamOperation
Description
Possible upstream operation types.

Values
Enum Value	Description
EQUALS

Value must match exactly.
CONTAINS

Value must contain the specified text.
DOES_NOT_CONTAIN

Value must not contain the specified text.
Example
"EQUALS"
Types
Url
Description
URL scalar. Uses the string graphql scalar type. Used to ensure returned links are valid and navigable

Example
Url
Types
ValidationFlaw
Description
Collection of validation flaw details for a given product addition answer.

Fields
Field Name	Description
partId - Int	The partId. No longer supported
questionId - String!	The questionId, returned from the productAddition.questions query.
parentRank - Int	Applicable when providing multiple answers for a multi-value question (i.e., isMultiValue == true). Set the first answer to number 1, then increment for subsequent answers. Can be used in conjunction with rank.
rank - Int	Applicable when providing multiple answers for a multi-choice question (i.e., QuestionAnswerType == MULTI_CHOICE). Set the first answer to number 1, then increment for subsequent answers. Can be used in conjunction with parentRank.
flawType - ValidationFlawType!	flawType。
flaw - String!	Human-readable description of validation flaws, with tips on how to fix them.
Example
{
  "partId": 987,
  "questionId": "abc123",
  "parentRank": 987,
  "rank": 987,
  "flawType": "ERROR",
  "flaw": "xyz789"
}
Types
ValidationFlawType
Description
The type of validation flaw. Errors must be remediated, while warnings may be remediated.

Values
Enum Value	Description
ERROR

Validation Error
WARNING

Validation Warning
Example
"ERROR"