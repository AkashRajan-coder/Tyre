module.exports = {
  "openapi": "3.0.0",

  "info": {
    "title": "Tyre Shop Follow-Up App — REST API",
    "version": "1.0.0",
    "description": `
**Comprehensive REST API Documentation for Tyre Shop Follow-Up App**

Provides endpoints for:

* **Authentication**
* **Employee Workflow**
* **Admin Workflow**
* **Super Admin Workflow**

### Roles

* SUPER_ADMIN
* ADMIN
* EMPLOYEE

### Authentication

All protected endpoints require:

Authorization: Bearer <JWT_TOKEN>
`
  },

  "servers": [
    {
      "url": "http://localhost:5000",
      "description": "Local Development Server"
    },
    {
      "url": "https://tyre-7c07.onrender.com",
      "description": "Production Server"
    }
  ],

  "components": {

    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Enter JWT token obtained from /api/v1/auth/login"
      }
    },

    "schemas": {

      "LoginRequest": {
        "type": "object",
        "required": [
          "phone",
          "password"
        ],
        "properties": {
          "phone": {
            "type": "string",
            "example": "9999999999"
          },
          "password": {
            "type": "string",
            "example": "admin123"
          }
        }
      },

      "CreateEnquiryRequest": {
        "type": "object",
        "required": [
          "shopId",
          "customerName",
          "customerPhone",
          "followUpDate"
        ],
        "properties": {
          "shopId": {
            "type": "string",
            "example": "shop-uuid"
          },
          "customerName": {
            "type": "string",
            "example": "Rohit Sharma"
          },
          "customerPhone": {
            "type": "string",
            "example": "9876543210"
          },
          "vehicleModel": {
            "type": "string",
            "example": "Hyundai Creta SX"
          },
          "vehicleReg": {
            "type": "string",
            "example": "TN-38-AB-1234"
          },
          "tyreSize": {
            "type": "string",
            "example": "215/60 R17"
          },
          "tyreBrand": {
            "type": "string",
            "example": "Bridgestone"
          },
          "quantity": {
            "type": "integer",
            "example": 4
          },
          "estimatedBudget": {
            "type": "number",
            "example": 38000
          },
          "followUpDate": {
            "type": "string",
            "format": "date-time",
            "example": "2026-09-20T10:00:00.000Z"
          },
          "remarks": {
            "type": "string",
            "example": "Customer wants tyre replacement."
          }
        }
      },

      "UpdateEnquiryRequest": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "enum": [
              "PENDING",
              "COMPLETED",
              "RESCHEDULED",
              "CANCELLED"
            ],
            "example": "COMPLETED"
          },
          "followUpDate": {
            "type": "string",
            "format": "date-time"
          },
          "remarks": {
            "type": "string",
            "example": "Customer purchased tyres."
          },
          "customerName": {
            "type": "string"
          },
          "vehicleModel": {
            "type": "string"
          },
          "tyreSize": {
            "type": "string"
          },
          "tyreBrand": {
            "type": "string"
          },
          "quantity": {
            "type": "integer"
          }
        }
      },

      "CreateShopRequest": {
        "type": "object",
        "required": [
          "name"
        ],
        "properties": {
          "name": {
            "type": "string",
            "example": "Expressway Tyre Zone"
          },
          "code": {
            "type": "string",
            "example": "EXP-03"
          },
          "address": {
            "type": "string",
            "example": "Expressway Service Road"
          },
          "phone": {
            "type": "string",
            "example": "9876543210"
          }
        }
      },

      "UpdateShopRequest": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "example": "Expressway Tyre Zone"
          },
          "code": {
            "type": "string",
            "example": "EXP-03"
          },
          "address": {
            "type": "string",
            "example": "Expressway Service Road"
          },
          "phone": {
            "type": "string",
            "example": "9876543210"
          },
          "isActive": {
            "type": "boolean",
            "example": true
          }
        }
      },

      "CreateUserRequest": {
        "type": "object",
        "required": [
          "phone",
          "password",
          "fullName"
        ],
        "properties": {
          "phone": {
            "type": "string",
            "example": "9833333333"
          },
          "password": {
            "type": "string",
            "example": "securepass123"
          },
          "fullName": {
            "type": "string",
            "example": "Kiran Rao"
          },
          "role": {
            "type": "string",
            "enum": [
              "EMPLOYEE",
              "ADMIN"
            ],
            "default": "EMPLOYEE"
          },
          "shopIds": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "example": [
              "shop-uuid"
            ]
          }
        }
      },

      "UpdateUserRequest": {
        "type": "object",
        "properties": {
          "phone": {
            "type": "string"
          },
          "fullName": {
            "type": "string"
          },
          "role": {
            "type": "string",
            "enum": [
              "ADMIN",
              "EMPLOYEE"
            ]
          },
          "shopIds": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        }
      },

      "CreateOrganizationRequest": {
        "type": "object",
        "required": [
          "name"
        ],
        "properties": {
          "name": {
            "type": "string",
            "example": "Elite Wheels & Tyres Ltd"
          },
          "slug": {
            "type": "string",
            "example": "elite-wheels"
          },
          "phone": {
            "type": "string",
            "example": "08088990011"
          },
          "email": {
            "type": "string",
            "example": "admin@elitewheels.com"
          },
          "address": {
            "type": "string",
            "example": "42 Tech Park Avenue"
          },
          "adminName": {
            "type": "string",
            "example": "Vikram Singhania"
          },
          "adminPhone": {
            "type": "string",
            "example": "9871112233"
          },
          "adminPassword": {
            "type": "string",
            "example": "adminPass123"
          }
        }
      },

      "UpdateOrganizationRequest": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "slug": {
            "type": "string"
          },
          "phone": {
            "type": "string"
          },
          "email": {
            "type": "string"
          },
          "address": {
            "type": "string"
          }
        }
      },

      "CreateBusinessAdminRequest": {
        "type": "object",
        "required": [
          "organizationId",
          "phone",
          "password",
          "fullName"
        ],
        "properties": {
          "organizationId": {
            "type": "string",
            "example": "org-uuid"
          },
          "phone": {
            "type": "string",
            "example": "9812345678"
          },
          "password": {
            "type": "string",
            "example": "adminSecret123"
          },
          "fullName": {
            "type": "string",
            "example": "Anil Kumar"
          }
        }
      }

    }
  },

  "tags": [
    {
      "name": "Auth",
      "description": "Authentication and current user"
    },
    {
      "name": "Employee",
      "description": "Employee enquiry workflow"
    },
    {
      "name": "Admin",
      "description": "Business Admin dashboard, shops, users and enquiries"
    },
    {
      "name": "Super Admin",
      "description": "Platform Super Admin organization and global management"
    }
  ],

  "paths": {

    /* =========================================================
       AUTH
       ========================================================= */

    "/api/v1/auth/login": {
      "post": {
        "tags": [
          "Auth"
        ],
        "summary": "Login",
        "description": "Login using phone number and password.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/LoginRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Login successful"
          },
          "401": {
            "description": "Invalid phone number or password"
          },
          "403": {
            "description": "Account deactivated"
          }
        }
      }
    },

    "/api/v1/auth/me": {
      "get": {
        "tags": [
          "Auth"
        ],
        "summary": "Get current logged-in user",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "User information returned"
          },
          "401": {
            "description": "Unauthorized"
          }
        }
      }
    },

    /* =========================================================
       EMPLOYEE
       ========================================================= */

    "/api/v1/employee/shops": {
      "get": {
        "tags": [
          "Employee"
        ],
        "summary": "Get employee assigned shops",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Assigned shops returned"
          }
        }
      }
    },

    "/api/v1/employee/banner-summary": {
      "get": {
        "tags": [
          "Employee"
        ],
        "summary": "Get follow-up banner summary",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "shopId",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Due today, tomorrow and overdue counts"
          }
        }
      }
    },

    "/api/v1/employee/check-duplicate": {
      "get": {
        "tags": [
          "Employee"
        ],
        "summary": "Check duplicate customer phone",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "phone",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "shopId",
            "in": "query",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "scope",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "shop",
                "all"
              ],
              "default": "shop"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Duplicate check result"
          }
        }
      }
    },

    "/api/v1/employee/enquiries": {
      "post": {
        "tags": [
          "Employee"
        ],
        "summary": "Create customer enquiry",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateEnquiryRequest"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Enquiry created successfully"
          }
        }
      }
    },

    "/api/v1/employee/pending": {
      "get": {
        "tags": [
          "Employee"
        ],
        "summary": "Get pending follow-ups",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "shopId",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "page",
            "in": "query",
            "schema": {
              "type": "integer",
              "default": 1
            }
          },
          {
            "name": "limit",
            "in": "query",
            "schema": {
              "type": "integer",
              "default": 20
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Pending enquiries"
          }
        }
      }
    },

    "/api/v1/employee/completed": {
      "get": {
        "tags": [
          "Employee"
        ],
        "summary": "Get completed follow-ups",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "shopId",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "page",
            "in": "query",
            "schema": {
              "type": "integer",
              "default": 1
            }
          },
          {
            "name": "limit",
            "in": "query",
            "schema": {
              "type": "integer",
              "default": 20
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Completed enquiries"
          }
        }
      }
    },

    "/api/v1/employee/search": {
      "get": {
        "tags": [
          "Employee"
        ],
        "summary": "Search customer enquiries",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "shopId",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "query",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Search results"
          }
        }
      }
    },

    "/api/v1/employee/enquiries/{id}": {
      "get": {
        "tags": [
          "Employee"
        ],
        "summary": "Get enquiry details",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "shopId",
            "in": "query",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Enquiry with activity logs"
          }
        }
      },

      "patch": {
        "tags": [
          "Employee"
        ],
        "summary": "Update enquiry",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateEnquiryRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Enquiry updated"
          }
        }
      }
    },

    /* =========================================================
       ADMIN DASHBOARD
       ========================================================= */

    "/api/v1/admin/dashboard": {
      "get": {
        "tags": [
          "Admin"
        ],
        "summary": "Get Admin Dashboard",
        "description": "Returns total enquiries, pending, completed, due today, overdue, conversion rate, active shops, active users and per-shop metrics.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Dashboard metrics returned"
          },
          "401": {
            "description": "Unauthorized"
          },
          "403": {
            "description": "Admin access required"
          }
        }
      }
    },

    /* =========================================================
       ADMIN ENQUIRIES
       ========================================================= */

    "/api/v1/admin/enquiries": {
      "get": {
        "tags": [
          "Admin"
        ],
        "summary": "Get all enquiries",
        "description": "Admin can view enquiries across shops within the organization.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "shopId",
            "in": "query",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "status",
            "in": "query",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "assignedToUserId",
            "in": "query",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "search",
            "in": "query",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "startDate",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date"
            }
          },
          {
            "name": "endDate",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date"
            }
          },
          {
            "name": "page",
            "in": "query",
            "schema": {
              "type": "integer",
              "default": 1
            }
          },
          {
            "name": "limit",
            "in": "query",
            "schema": {
              "type": "integer",
              "default": 25
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Enquiries returned"
          }
        }
      }
    },

    "/api/v1/admin/enquiries/{id}/reassign": {
      "patch": {
        "tags": [
          "Admin"
        ],
        "summary": "Reassign enquiry",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "assignedToUserId"
                ],
                "properties": {
                  "assignedToUserId": {
                    "type": "string",
                    "example": "employee-uuid"
                  },
                  "remarks": {
                    "type": "string",
                    "example": "Reassigned to another employee."
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Enquiry reassigned successfully"
          },
          "400": {
            "description": "Target employee is invalid"
          },
          "404": {
            "description": "Enquiry not found"
          }
        }
      }
    },

    "/api/v1/admin/enquiries/{id}": {
      "delete": {
        "tags": [
          "Admin"
        ],
        "summary": "Soft delete enquiry",
        "description": "Sets customer_enquiries.is_deleted to 1.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": false,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "reason": {
                    "type": "string",
                    "example": "Duplicate enquiry"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Enquiry deleted successfully"
          },
          "404": {
            "description": "Enquiry not found"
          }
        }
      }
    },

    /* =========================================================
       ADMIN SHOPS
       ========================================================= */

    "/api/v1/admin/shops": {
      "get": {
        "tags": [
          "Admin"
        ],
        "summary": "List all shops",
        "description": "Returns non-deleted shops for the Admin organization.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Shop list returned"
          }
        }
      },

      "post": {
        "tags": [
          "Admin"
        ],
        "summary": "Create shop",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateShopRequest"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Shop created successfully"
          },
          "400": {
            "description": "Shop name or organization is missing"
          }
        }
      }
    },

    "/api/v1/admin/shops/{id}": {
      "patch": {
        "tags": [
          "Admin"
        ],
        "summary": "Update shop",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateShopRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Shop updated successfully"
          },
          "404": {
            "description": "Shop not found or already deleted"
          }
        }
      },

      "delete": {
        "tags": [
          "Admin"
        ],
        "summary": "Soft delete shop",
        "description": "Sets is_active = 0 and is_deleted = true.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Shop deleted successfully"
          },
          "404": {
            "description": "Shop not found or already deleted"
          }
        }
      }
    },

    "/api/v1/admin/shops/{id}/deactivate": {
      "patch": {
        "tags": [
          "Admin"
        ],
        "summary": "Deactivate shop",
        "description": "Sets shops.is_active = 0. is_deleted remains false.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Shop deactivated successfully"
          },
          "404": {
            "description": "Shop not found or already deleted"
          }
        }
      }
    },

    "/api/v1/admin/shops/{id}/activate": {
      "patch": {
        "tags": [
          "Admin"
        ],
        "summary": "Activate shop",
        "description": "Sets shops.is_active = 1. Shop must not be soft deleted.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Shop activated successfully"
          },
          "404": {
            "description": "Shop not found or already deleted"
          }
        }
      }
    },

    /* =========================================================
       ADMIN USERS
       ========================================================= */

    "/api/v1/admin/users": {
      "get": {
        "tags": [
          "Admin"
        ],
        "summary": "List users",
        "description": "Returns ADMIN and EMPLOYEE users in the organization.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Users returned"
          }
        }
      },

      "post": {
        "tags": [
          "Admin"
        ],
        "summary": "Create user",
        "description": "Creates an ADMIN or EMPLOYEE user and optionally assigns shops.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateUserRequest"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "User created successfully"
          },
          "400": {
            "description": "Invalid user data"
          }
        }
      }
    },

    "/api/v1/admin/users/{id}": {
      "patch": {
        "tags": [
          "Admin"
        ],
        "summary": "Update user",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateUserRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "User updated successfully"
          },
          "404": {
            "description": "User not found"
          }
        }
      },

      "delete": {
        "tags": [
          "Admin"
        ],
        "summary": "Soft delete user",
        "description": "Sets users.is_active = 0 and users.is_deleted = true.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "User deleted successfully"
          },
          "404": {
            "description": "User not found or already deleted"
          }
        }
      }
    },

    "/api/v1/admin/users/{id}/deactivate": {
      "patch": {
        "tags": [
          "Admin"
        ],
        "summary": "Deactivate user",
        "description": "Sets users.is_active = 0 while keeping is_deleted = false. User login will be blocked.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "User deactivated successfully"
          },
          "404": {
            "description": "User not found in your organization"
          }
        }
      }
    },

    "/api/v1/admin/users/{id}/activate": {
      "patch": {
        "tags": [
          "Admin"
        ],
        "summary": "Activate user",
        "description": "Sets users.is_active = 1. User must not be soft deleted.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "User activated successfully"
          },
          "404": {
            "description": "User not found or already deleted"
          }
        }
      }
    },

    "/api/v1/admin/users/{id}/reset-password": {
      "post": {
        "tags": [
          "Admin"
        ],
        "summary": "Reset user password",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "required": [
                  "password"
                ],
                "properties": {
                  "password": {
                    "type": "string",
                    "example": "newPassword123"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Password reset successfully"
          },
          "404": {
            "description": "User not found"
          }
        }
      }
    },

    /* =========================================================
       ADMIN CSV
       ========================================================= */

    "/api/v1/admin/export/csv": {
      "get": {
        "tags": [
          "Admin"
        ],
        "summary": "Export enquiries CSV",
        "description": "Exports organization enquiry data as CSV.",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "shopId",
            "in": "query",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "status",
            "in": "query",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "startDate",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date"
            }
          },
          {
            "name": "endDate",
            "in": "query",
            "schema": {
              "type": "string",
              "format": "date"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "CSV export"
          }
        }
      }
    },

    /* =========================================================
       SUPER ADMIN
       ========================================================= */

    "/api/v1/super-admin/dashboard": {
      "get": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Super Admin Dashboard",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Global platform dashboard"
          },
          "403": {
            "description": "Super Admin access required"
          }
        }
      }
    },

    "/api/v1/super-admin/organizations": {
      "get": {
        "tags": [
          "Super Admin"
        ],
        "summary": "List organizations",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Organizations returned"
          }
        }
      },

      "post": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Create organization",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateOrganizationRequest"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Organization created successfully"
          }
        }
      }
    },

    "/api/v1/super-admin/organizations/{id}": {
      "get": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Get organization details",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Organization details"
          },
          "404": {
            "description": "Organization not found"
          }
        }
      },

      "patch": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Update organization",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/UpdateOrganizationRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Organization updated"
          }
        }
      },

      "delete": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Delete organization",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Organization deleted"
          }
        }
      }
    },

    "/api/v1/super-admin/organizations/{id}/activate": {
      "patch": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Activate organization",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Organization activated"
          }
        }
      }
    },

    "/api/v1/super-admin/organizations/{id}/deactivate": {
      "patch": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Deactivate organization",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Organization deactivated"
          }
        }
      }
    },

    "/api/v1/super-admin/business-admins": {
      "get": {
        "tags": [
          "Super Admin"
        ],
        "summary": "List business admins",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Business admins returned"
          }
        }
      },

      "post": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Create business admin",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateBusinessAdminRequest"
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Business admin created"
          }
        }
      }
    },

    "/api/v1/super-admin/business-admins/{id}": {
      "patch": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Update business admin",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "fullName": {
                    "type": "string"
                  },
                  "phone": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Business admin updated"
          }
        }
      },

      "delete": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Delete business admin",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Deleted"
          }
        }
      }
    }

  }
};