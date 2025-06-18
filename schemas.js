/**
 * @swagger
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: |
 *         JWT-based authentication for web app users. The token is obtained by authenticating via the login endpoint.
 *
 *         ### How to authenticate:
 *         1. Send a POST request to `/login` with your username and password
 *         2. The server will respond with a JWT token (also set as a cookie in browsers)
 *         3. Include this token in the `Authorization` header as `Bearer {token}`
 *
 *         Example:
 *         ```
 *         Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         ```
 *
 *         JWT tokens are valid for 24 hours after issuance.
 *
 *     ApiKeyAuth:
 *       type: apiKey
 *       in: header
 *       name: x-api-key
 *       description: |
 *         API key authentication for programmatic access. The API key can be generated or regenerated using the /api/key-regenerate endpoint.
 *
 *         ### How to authenticate:
 *         1. Access the API key from your application settings
 *         2. Include the API key in the `x-api-key` HTTP header for all requests
 *
 *         Example:
 *         ```
 *         x-api-key: 7c1f3f5e2b0a9d8c6e4b2a1d3f5e8c9b2a1d3f5e
 *         ```
 *
 *         API keys do not expire unless regenerated.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message
 *           example: Error resetting documents
 *
 *     User:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *           description: User's username
 *           example: admin
 *         password:
 *           type: string
 *           format: password
 *           description: User's password (will be hashed)
 *           example: securePassword123
 *         id:
 *           type: integer
 *           description: User ID (auto-generated)
 *           example: 1
 *           readOnly: true
 *
 *     LoginRequest:
 *       type: object
 *       required:
 *         - username
 *         - password
 *       properties:
 *         username:
 *           type: string
 *           description: User's username
 *           example: admin
 *         password:
 *           type: string
 *           format: password
 *           description: User's password
 *           example: securePassword123
 *
 *     LoginResponse:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *           description: JWT token for authentication
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         expiresIn:
 *           type: string
 *           description: Token expiration time
 *           example: 24h
 *
 *     Document:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Document ID
 *           example: 123
 *         title:
 *           type: string
 *           description: Document title
 *           example: Invoice #12345
 *         tags:
 *           type: array
 *           items:
 *             type: integer
 *           description: Array of tag IDs
 *           example: [1, 4, 7]
 *         correspondent:
 *           type: integer
 *           description: Correspondent ID
 *           example: 5
 *         created:
 *           type: string
 *           format: date-time
 *           description: Document creation date
 *           example: 2023-12-15T10:30:00Z
 *         document_type:
 *           type: integer
 *           description: Document type ID
 *           example: 2
 *         content:
 *           type: string
 *           description: Document text content
 *           example: "This is an invoice from Company XYZ..."
 *         language:
 *           type: string
 *           description: Document language code
 *           example: en
 *         custom_fields:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CustomField'
 *           description: Custom field values for the document
 *
 *     DocumentUpdateRequest:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           description: New document title
 *           example: Updated Invoice #12345
 *         tags:
 *           type: array
 *           items:
 *             type: integer
 *           description: Array of tag IDs
 *           example: [1, 4, 7]
 *         correspondent:
 *           type: integer
 *           description: Correspondent ID
 *           example: 5
 *         document_type:
 *           type: integer
 *           description: Document type ID
 *           example: 2
 *         language:
 *           type: string
 *           description: Document language code
 *           example: en
 *         custom_fields:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CustomField'
 *           description: Custom field values for the document
 *
 *     CustomField:
 *       type: object
 *       required:
 *         - field
 *         - value
 *       properties:
 *         field:
 *           type: integer
 *           description: Custom field ID
 *           example: 3
 *         value:
 *           type: string
 *           description: Custom field value
 *           example: "123.45"
 *
 *     AnalysisResult:
 *       type: object
 *       properties:
 *         document:
 *           type: object
 *           properties:
 *             title:
 *               type: string
 *               description: Suggested document title
 *               example: Invoice from ABC Corporation
 *             tags:
 *               type: array
 *               items:
 *                 type: string
 *               description: Suggested tags
 *               example: ["invoice", "utilities", "2023"]
 *             correspondent:
 *               type: string
 *               description: Suggested correspondent name
 *               example: ABC Corporation
 *             document_type:
 *               type: string
 *               description: Suggested document type
 *               example: Invoice
 *             document_date:
 *               type: string
 *               format: date-time
 *               description: Extracted document date
 *               example: 2023-12-15T00:00:00Z
 *             language:
 *               type: string
 *               description: Detected document language
 *               example: en
 *             custom_fields:
 *               type: object
 *               additionalProperties:
 *                 type: object
 *                 properties:
 *                   field_name:
 *                     type: string
 *                     description: Custom field name
 *                     example: invoice_amount
 *                   value:
 *                     type: string
 *                     description: Custom field value
 *                     example: "123.45"
 *         metrics:
 *           type: object
 *           properties:
 *             promptTokens:
 *               type: integer
 *               description: Number of tokens in the prompt
 *               example: 450
 *             completionTokens:
 *               type: integer
 *               description: Number of tokens in the completion
 *               example: 120
 *             totalTokens:
 *               type: integer
 *               description: Total tokens used
 *               example: 570
 *         error:
 *           type: string
 *           description: Error message if analysis failed
 *           example: null
 *
 *     Tag:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Tag ID
 *           example: 5
 *         name:
 *           type: string
 *           description: Tag name
 *           example: Invoice
 *         color:
 *           type: string
 *           description: Tag color (hex code)
 *           example: "#FF5733"
 *         match:
 *           type: string
 *           enum: [ANY, ALL, LITERAL, REGEX]
 *           description: Tag matching algorithm
 *           example: ANY
 *
 *     HistoryItem:
 *       type: object
 *       properties:
 *         document_id:
 *           type: integer
 *           description: Document ID
 *           example: 123
 *         title:
 *           type: string
 *           description: Document title
 *           example: Invoice #12345
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Date and time when the processing occurred
 *           example: 2023-12-15T10:30:00Z
 *         tags:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Tag'
 *         correspondent:
 *           type: string
 *           description: Document correspondent name
 *           example: Acme Corp
 *         link:
 *           type: string
 *           description: Link to the document in Paperless-ngx
 *           example: http://paperless.example.com/documents/123/
 *
 *     HistoryResponse:
 *       type: object
 *       properties:
 *         draw:
 *           type: integer
 *           description: DataTables draw counter echo
 *           example: 1
 *         recordsTotal:
 *           type: integer
 *           description: Total number of records in database
 *           example: 100
 *         recordsFiltered:
 *           type: integer
 *           description: Number of records after filtering
 *           example: 25
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/HistoryItem'
 *
 *     ChatMessage:
 *       type: object
 *       required:
 *         - documentId
 *         - message
 *       properties:
 *         documentId:
 *           type: integer
 *           description: ID of the document the chat is about
 *           example: 123
 *         message:
 *           type: string
 *           description: User's message to the AI
 *           example: What is the invoice amount?
 *
 *     ChatInitResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Whether initialization was successful
 *           example: true
 *         message:
 *           type: string
 *           description: Status message
 *           example: Chat initialized for document 123
 *
 *     APIKeyResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: string
 *           description: The newly generated API key
 *           example: 7c1f3f5e2b0a9d8c6e4b2a1d3f5e8c9b2a1d3f5e
 *
 *     HealthResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [healthy, not_configured, error]
 *           description: System health status
 *           example: healthy
 *         message:
 *           type: string
 *           description: Additional status information (for non-healthy states)
 *           example: Application setup not completed
 */

// This file only contains JSDoc comments for Swagger schema definitions
// No actual code is needed
