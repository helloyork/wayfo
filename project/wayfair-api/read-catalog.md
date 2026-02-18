Guide to the Wayfair Catalog Read API

This guide provides a complete walkthrough for integrating with Wayfair's Catalog API. This API allows you to programmatically export your product catalog information, including all SKUs, base pricing, dimensions, images, and other product details.
1. Overview & Core Concepts

The primary purpose of the Catalog API is to allow you to read and export your product data from Wayfair's systems. This is useful for synchronizing your internal systems with the data Wayfair has on file, auditing your catalog, or populating internal dashboards.
Key Concepts

Pagination: The API returns large sets of products in smaller, manageable chunks called "pages." You must use the pagination options and check the response to loop through all the pages to get your complete catalog.
Filtering: You can filter your product list to find specific items. However, a key rule of this API is that you can only use one filter type at a time (e.g., you can filter by supplierPartNumber or by className, but not both in the same request).
2. The Integration Workflow (Step-by-Step)

The Catalog API has one primary query operation: supplierCatalog.
Step 1: Construct the GraphQL Query

Use this query structure to define the product data fields you want to receive in the response. The example below is a starting point; the full list of available fields is extensive and can be found in the GraphQL specification.

Code snippet

# Defines the query's name and the variables it can accept
query GetSupplierCatalog($supplierId: Int!, $filter: ProductFilter, $paginationOptions: PaginationOptions) {
    # Calls the supplierCatalog action, passing in your variables
    supplierCatalog(supplierId: $supplierId, filter: $filter, paginationOptions: $paginationOptions) {
        supplierId      # Asks for the supplier ID
        pageInfo {      # Asks for the pagination details
            page
            pageSize
            hasNextPage
            totalPages
        }
        products {      # Asks for the list of products that match the query
            productId
            supplierPartNumber
            status
            skus {
                sku
                productName
                retailPrice {
                    unit { amount currency }
                }
            }
            # Add other product fields here as needed (e.g., images, videos, documents)
        }
    }
}

Step 2: Prepare Your Query (The Variables)

Your request will include variables that specify the supplier, filters, and page you want to retrieve.
Variable
Type
Description
When to Use It
supplierId
Integer!
(Required) The top-level supplier ID for the catalog you want to query.
Every request must include a supplierId.
filter
Object
An object containing the filter criteria. You can only use one of the sub-fields at a time.
Use this when you need to find specific products, such as filtering by supplierPartNumber or sku.
paginationOptions
Object
An object to control which page of results to return.
Use this in every call to navigate through the full set of results.
Filter Object Fields: (filter)
className: Filter by product class name.
supplierPartNumber: Filter by a list of your part numbers.
productId: Filter by a list of Wayfair's internal product IDs.
sku: Filter by a list of Wayfair's internal SKUs.
Pagination Object Fields: (paginationOptions)
page: The page number you want to retrieve (starts at 1).
pageSize: The number of products per page. Allowed values are 10, 20, or 25.

Step 3: Test Your Integration in the Sandbox

Before going live, you should test your integration using the sandbox environment. This is a required step before getting access to the Production endpoint. 
Sandbox Endpoint: https://api.wayfair.io/sandbox/v1/supplier-catalog-api/graphql
Step 4: Interpret the API Response

pageInfo object: This is critical for pagination. Check hasNextPage: true and loop from page: 1 through totalPages to get all your products.
products array: This contains the list of product data you requested.
errors array: Always check for errors. The API uses two types:
Fatal Errors: Your entire request was rejected (e.g., "Access Denied" due to an incorrect token scope).
Validation Errors: Your request was invalid (e.g., "Cannot pass multiple filter at a time"). You must fix the variables and resubmit.
Step 5 : Going Live

Once your sandbox testing is complete, you can move to the production environment.
Production Endpoint: https://api.wayfair.io/v1/supplier-catalog-api/graphql
Authentication: Ensure your Bearer token has the required scope: read:catalog_products.
3. Best Practices & Important Rules

Use Pagination: To get your full catalog, you must check the pageInfo object in the response and make subsequent calls, incrementing the page variable until you have retrieved all totalPages.
Filter Restriction: Do not use more than one filter type (e.g., className and sku) in a single request. This will result in a validation error.
Error Handling: Build logic to handle both Fatal and Validation errors returned in the errors array.
4. Submission Frequency and Rate Limits

Rate Limit: The current rate limit is 10 requests per second, with each request having a max page size of 25.
5. Practical Examples

Here are common scenarios showing the GraphQL query and the corresponding "variables" payload.
- Example 1: Getting the First Page of All Products

The Query:

Code snippet
query GetSupplierCatalog($supplierId: Int!, $paginationOptions: PaginationOptions) {
    supplierCatalog(supplierId: $supplierId, paginationOptions: $paginationOptions) {
        pageInfo { hasNextPage, totalPages }
        products { productId, supplierPartNumber }
    }
}

The Variables:
{
    "supplierId": 23403,
    "paginationOptions": {
        "page": 1,
        "pageSize": 10
    }
}

- Example 2: Querying to Obtain Product Name for a filtered Supplier Part Number

The Query:
query GetSupplierCatalog($supplierId: Int!, $filter: ProductFilter) {
    supplierCatalog(supplierId: $supplierId, filter: $filter) {
        products {
            productId
            supplierPartNumber
            skus { productName }
        }
    }
}

The Variables:
{
    "supplierId": 23403,
    "filter": {
        "supplierPartNumber": {
            "in": ["LBW020433"]
        }
    }
}