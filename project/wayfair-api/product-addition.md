Guide to the Product Addition API

This guide provides a complete walkthrough for using Wayfair’s Product Addition API. This is an orchestrated workflow that uses multiple API calls to gather required information before submitting a new product to Wayfair’s catalog.
1. Overview & Core Concepts

The Product Addition API allows you to programmatically create new products on Wayfair. The process is asynchronous and follows three main phases:
Discovery Phase: Before you can submit a product, you must use several read-only queries to gather required IDs and metadata. This includes finding the correct product taxonomy, your available manufacturer brands, and valid tags for any documents you plan to upload.
Submission Phase: You will use the submit mutation to send a payload containing all the product details, including answers to the questions you discovered in the previous phase.
Status Tracking Phase: The submit mutation only acknowledges that your request was received. You must then use the submissions query with the requestId returned from the submission to track the validation and processing status of your new product.
Key Concept: Asynchronous Processing
Adding a product is not instantaneous. The submit mutation is asynchronous. It gives you back a requestId and begins processing in the background. You are required to use this requestId in the submissions query to poll for the status and check for any validation errors.
2. The Integration Workflow (Step-by-Step)

Step 1: The Discovery Phase (Gather Required Data)

Before you can build your submit payload, you must gather several key pieces of information.
Discover Taxonomy and Questions: This is the most critical part of the discovery phase. You will use a series of queries to find the right product category (taxonomyCategoryId) and get the list of all required and optional attributes formatted as questions. For a complete walkthrough, please see the Guide to Product Taxonomy.
Get Brand Associations: You must provide a valid manufacturerId for each product. Use the brandAssociations query to get the list of brands you are approved to sell for a given market.

Code snippet
# Defines the query and its 'request' input variable
query brandAssociations($request: GetSupplierBrandsAssociationsRequest!) {
    supplierBrand {
        # Calls the brandAssociations action
        brandAssociations(request: $request) {
            brands {
                manufacturer {
                    id
                    name
                }
            }
            pageInfo {
                hasNextPage
                totalPages
            }
        }
    }
}


Preparing Your Query (The Variables):
Variable
Type
Required?
Description
supplierId
Integer
Yes
Your top-level supplier ID.
marketContext
Object
Yes
The market (country, brand, locale) you are checking for brands.
page
Integer
No
The page number to retrieve, used for pagination.
pageSize
Integer
Yes
The number of brands to return per page.
3. Get Media Tags: If you are uploading documents (like instruction manuals), you must use valid tags. Use the mediaMetaDataTags query to get the list of possible tags.

Code snippet
# Defines the query and its 'mediaMetaDataTag' input variable
query GetMediaMetaDataTags($mediaMetaDataTag: MediaMetaDataTagInput!) {
    media {
        # Calls the mediaMetaDataTags action
        mediaMetaDataTags(mediaMetaDataTag: $mediaMetaDataTag) {
            metaDataTagType
            metaDataTags {
                name
            }
        }
    }
}

Preparing Your Query (The Variables):
Variable
Type
Required?
Description
metaDataTagTypes
[Enum]
Yes
An array of the tag types you want to retrieve. Possible values are DOCUMENT, LEGAL_DOCUMENT, LANGUAGE, and REGION.
marketContext
Object
Yes
The market you are getting tags for.

Step 2: Submit the New Product (submit)

This is the main "write" operation where you send all the product information you've gathered. Unlike other APIs, the submit mutation does not return an error object in its response. This is because it is an asynchronous process. Its only job is to accept your request and return requestIds. You will check for the status of the submission and errors (called validationFlaws) in the next step.
Sandbox Endpoint: https://api.wayfair.io/sandbox/v1/product-catalog-api/graphql

Code snippet
# Defines the mutation and its main 'request' input variable
mutation submit($request: SubmitProductAdditionsRequest!) {
    productAddition {
        # Calls the 'submit' action, passing in your product data
        submit(request: $request) {
            requestIds # Asks for the unique IDs for this submission batch
        }
    }
}

Preparing Your Data (The Variables):
The submit mutation takes a single, complex request object.
Variable
Type
Required?
Description
supplierId
ID!
Yes
Your top-level supplier ID.
proposedProductAdditions
[Object]!
Yes
An array where each object represents a group of products being added to the same product class and market.
classId
Integer!
Yes
The taxonomyCategoryId you found in the discovery phase.
marketContext
Object!
Yes
The market (country, brand) for this product addition.
parts
[Object]!
Yes
An array where each object is a unique product or variant. It contains all product details (see below).
parts.supplierPartNumber
String!
Yes
Your unique part number for the product.
parts.manufacturerId
ID!
Yes
The ID for the product's brand, which you found using the brandAssociations query.
parts.answers
[Object]!
Yes
An array of answer objects that correspond to the questions you discovered. Each answer must have a questionId and a value.
rejectAllOnErrors
Boolean
No
If true, the entire submission will be rejected if even one product has a validation error. Defaults to false. Recommended to use true when submitting variants.
ignoreWarnings
Boolean
No
If true, the submission will proceed even if it has validation warnings (but will still fail on errors). Defaults to false.
Step 3: Track Submission Status (submissions)

After submitting, use the requestIds from the submit response to check the status with the submissions query.
Sandbox Endpoint: https://api.wayfair.io/sandbox/v1/product-catalog-api/graphql
# Defines the query and its 'request' input variable
query submissions($request: GetProductAdditionsRequest!) {
    productAddition {
        # Calls the 'submissions' action, passing in the IDs to check
        submissions(request: $request) {
            supplierPartNumber
            status
            validationStatus
            submissionStatus
            validationFlaws {
                questionId
                flawType
                flaw
            }
        }
    }
}

Preparing Your Query (The Variables):
Variable
Type
Required?
Description
supplierId
ID!
Yes
Your top-level supplier ID.
ids
[ID!]!
Yes
An array of the requestIds you received from the submit mutation response.
Step 4 : Interpreting Statuses and Handling Flaws

The status of your submission will progress through several states.
Status Progression: VALIDATING ► PROCESSING ► SUBMITTED.
This entire process should take less than 30 minutes. If a product is stuck in a transitory state for longer, it should be considered failed and resubmitted.
Handling Validation Failures: If your submission has errors, the status will become VALIDATED and the validationStatus will be FAILED. The validationFlaws array will be populated with details. You must correct the data for the specified questionId and resubmit the entire product payload.
Checking Final Live Status: Once the submissionStatus is SUCCEEDED, the product enters Wayfair's internal review pipeline. You can check if the product has gone live by searching for the supplierPartNumber in Partner Home or by using the Catalog Read API.
Step 5 : Sandbox Testing & Go-Live

Testing: You must test the full Discovery -> Submit -> Status Tracking workflow in the sandbox.
Production Endpoint: https://api.wayfair.io/v1/product-catalog-api/graphql
Go-Live: Once testing is complete, switch to your Production Keys and the Production Endpoint. Ensure your token has the necessary scopes (read-product-create-submit-status, read-product-create-questions,  read-product-create-questions, read-supplier-brand-associations write-product-create-submit).
3. Best Practices & Important Rules

Batching: Limit submissions to 100 products per request to stay within API limits. If your submission has more than 100 variants in the same group, suppliers are expected to create multiple batches to submit, and create a ticket to help merge the products from the multiple batches to one Variant Group on Wayfair.com.
Submitting Variants: To ensure products that are variants of each other are grouped correctly, submit them together in the same parts array and set rejectAllOnErrors: true.
Use Optional Fields: You can provide top-level fields like productName, collectionName, and media within the parts object. Doing so will "auto-answer" the corresponding questions, and you can omit them from the answers array.
Handling Warnings (ignoreWarnings): It is generally recommended to set ignoreWarnings: true. Only set this to false if your system is built to specifically parse validationFlaws for warnings, make corrections, and then resubmit.
Media is Required: A product must have at least one image to go live.
Synchronization: Taxonomy can change. It is recommended to refresh your taxonomy mapping at least once a month to detect any changes.
4. Submission Frequency and Rate Limits

Query Rate Limit: The discovery queries (taxonomy, brands, submissions etc.) are subject to a rate limit of 10 requests per second.
Submission Payload Limit: The submit mutation is limited by payload size (15 MB Max). Wayfair recommends a maximum of 100 products per submission. You can perform 1 submission per second. 
5. Practical Examples

- Example 1: Submitting a Single Product

This example shows the "variables" for a submit mutation to add one product with two simple answers.
The Mutation:

Code snippet
mutation submit($request: SubmitProductAdditionsRequest!) {
    productAddition {
        submit(request: $request) {
            requestIds
        }
    }
}

The Variables:
{
  "request": {
    "supplierId": 12345,
    "proposedProductAdditions": [
      {
        "classId": 3,
        "marketContext": { "locale": "en-US", "country": "UNITED_STATES", "brand": "WAYFAIR" },
        "parts": [
          {
            "productName": "Modern Utility Cart",
            "supplierPartNumber": "SUPPLIER-PART-ABC-123",
            "manufacturerId": 1,
            "answers": [
              {
                "questionId": "70241",
                "value": "Yes"
              },
              {
                "questionId": "149784",
                "value": "4"
              }
            ]
          }
        ]
      }
    ]
  }
}

- Example 2: Submitting Product Variants

To group variants (e.g., the same chair in different colors), submit them in the same parts array and set rejectAllOnErrors: true. This example uses a manufacturerId from the brandAssociations query and media from the mediaMetaDataTags query. In this the media is attached to the second - Blue Chair. 
The Mutation:

Code snippet
mutation submit($request: SubmitProductAdditionsRequest!) {
    productAddition {
        submit(request: $request) {
            requestIds
        }
    }
}

The Variables:

Code snippet
{
  "request": {
    "supplierId": 12345,
    "rejectAllOnErrors": true,
    "proposedProductAdditions": [
      {
        "classId": 168,
        "marketContext": { "locale": "en-US", "country": "UNITED_STATES", "brand": "WAYFAIR" },
        "parts": [
          {
            "productName": "Upholstered Dining Chair",
            "supplierPartNumber": "CHAIR-RED-FABRIC",
            "manufacturerId": 1,
            "answers": [
              { "questionId": "color_question_id", "value": "Red" }
            ],
            "media": { "images": [ "https://.../red_chair.jpg" ] }
          },
          {
            "productName": "Upholstered Dining Chair",
            "supplierPartNumber": "CHAIR-BLUE-FABRIC",
            "manufacturerId": 1,
            "answers": [
              { "questionId": "color_question_id", "value": "Blue" }
            ],
            "media": {
              "images": [ "https://.../blue_chair.jpg" ],
              "documents": [
                {
                  "mediaDocumentType": "DOCUMENT",
                  "documentUrl": "https://.../manual.pdf",
                  "documentTypes": [ "Owner Manual" ],
                  "regionType": "US",
                  "language": "English (United States)"
                }
              ]
            }
          }
        ]
      }
    ]
  }
}

