module.exports = {
  "openapi": "3.0.0",
  "info": {
    "title": "Tyre Shop Follow-Up App — REST API",
    "version": "1.0.0",
    "description": "\n**Comprehensive REST API Documentation for Tyre Shop Follow-Up App**\n\nProvides endpoints for:\n* **Authentication**: Phone + Password with multi-shop detection\n* **Employee Workflow**:\n  - Shop Picker\n  - In-App Banner (Due Today / Tomorrow / Overdue)\n  - Duplicate Phone Verification\n  - 4 Home Tabs: Add Customer Enquiry (immutable shop_id), Pending Follow-ups, Completed Follow-ups, and Fast Search\n  - Follow-up Detail & Action (Status, Reschedule, Remarks, Audit logs)\n* **Admin Workflow**:\n  - Unrestricted cross-shop Dashboard with conversion rates\n  - All Entries multi-shop view with global filters\n  - Reassignment of enquiries\n  - Soft deletes (is_deleted = 1)\n  - Shop Management (Create, Update, Deactivate)\n  - User Management (Create, Edit, Reset Password, Deactivate - 403 login block)\n  - CSV Report Export\n\n**Pre-seeded Demo Credentials:**\n* **Super Admin**: Phone: `9999999999`, Password: `admin123`\n* **Employee (Multi-Shop)**: Phone: `9811111111`, Password: `emp123`\n* **Employee (Single-Shop)**: Phone: `9822222222`, Password: `emp123`\n    "
  },
  "servers": [
    {
      "url": "http://localhost:5000",
      "description": "Local Development Server"
    }
  ],
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Enter your JWT token obtained from /api/v1/auth/login"
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
            "example": "9811111111"
          },
          "password": {
            "type": "string",
            "example": "emp123"
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
            "example": "39caf0a7-5177-40aa-9aa9-c1b5c4f1c4e1"
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
            "example": "KA-01-AB-1234"
          },
          "tyreSize": {
            "type": "string",
            "example": "215/60 R17"
          },
          "tyreBrand": {
            "type": "string",
            "example": "Bridgestone Dueler"
          },
          "quantity": {
            "type": "integer",
            "example": 4,
            "default": 4
          },
          "estimatedBudget": {
            "type": "number",
            "example": 38000
          },
          "followUpDate": {
            "type": "string",
            "format": "date-time",
            "example": "2026-09-17T10:00:00.000Z"
          },
          "remarks": {
            "type": "string",
            "example": "Customer inquiring about warranty and installment options."
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
            "example": "Customer purchased 4 tyres. Job complete."
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
            "example": "Plot 12, Expressway Service Rd"
          },
          "phone": {
            "type": "string",
            "example": "080-44556677"
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
              "39caf0a7-5177-40aa-9aa9-c1b5c4f1c4e1"
            ]
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
            "example": "080-88990011"
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
            "example": "org-uuid-here"
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
            "example": "Anil Kumar (Branch Head)"
          }
        }
      }
    }
  },
  "tags": [
    {
      "name": "Super Admin",
      "description": "Platform SaaS Owner endpoints (Manage Organizations, Business Admins, Global Metrics)"
    },
    {
      "name": "Auth",
      "description": "Login and profile verification"
    },
    {
      "name": "Employee",
      "description": "Employee workflows (Home tabs, banner, enquiry CRUD)"
    },
    {
      "name": "Admin",
      "description": "Admin workflows (Dashboard, multi-shop enquiries, users & shops)"
    }
  ],
  "paths": {
    "/api/v1/auth/login": {
      "post": {
        "tags": [
          "Auth"
        ],
        "summary": "Login with Phone + Password",
        "description": "Returns JWT token, user info, assigned shops, and hasMultipleShops flag (for Flutter Shop Picker).",
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
            "description": "Invalid credentials"
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
        "summary": "Get current user profile and assigned shops",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "User profile returned"
          },
          "401": {
            "description": "Unauthorized"
          }
        }
      }
    },
    "/api/v1/employee/shops": {
      "get": {
        "tags": [
          "Employee"
        ],
        "summary": "Shop Picker: Get active shops assigned to employee",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "List of assigned shops"
          }
        }
      }
    },
    "/api/v1/employee/banner-summary": {
      "get": {
        "tags": [
          "Employee"
        ],
        "summary": "In-App Banner: Due Today, Due Tomorrow, Overdue counts",
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
            },
            "description": "Active Shop ID"
          }
        ],
        "responses": {
          "200": {
            "description": "Banner metrics returned"
          }
        }
      }
    },
    "/api/v1/employee/check-duplicate": {
      "get": {
        "tags": [
          "Employee"
        ],
        "summary": "Check for duplicate customer phone before save",
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
            "required": false,
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
        "summary": "Tab 1: Add Customer Enquiry (shop_id is permanently set)",
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
        "summary": "Tab 2: Get pending follow-ups for active shop",
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
            "description": "Pending follow-ups list"
          }
        }
      }
    },
    "/api/v1/employee/completed": {
      "get": {
        "tags": [
          "Employee"
        ],
        "summary": "Tab 3: Get completed follow-ups for active shop",
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
            "description": "Completed follow-ups list"
          }
        }
      }
    },
    "/api/v1/employee/search": {
      "get": {
        "tags": [
          "Employee"
        ],
        "summary": "Tab 4: Fast Customer Search by name, phone, tyre, vehicle",
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
            },
            "description": "Search keyword"
          }
        ],
        "responses": {
          "200": {
            "description": "Matching search results"
          }
        }
      }
    },
    "/api/v1/employee/enquiries/{id}": {
      "get": {
        "tags": [
          "Employee"
        ],
        "summary": "Follow-up Detail: Get enquiry with full activity logs",
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
            "required": false,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Enquiry details with logs"
          }
        }
      },
      "patch": {
        "tags": [
          "Employee"
        ],
        "summary": "Follow-up Action: Update status, reschedule, remarks",
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
    "/api/v1/admin/dashboard": {
      "get": {
        "tags": [
          "Admin"
        ],
        "summary": "Admin Dashboard: Aggregated & per-shop counts with conversion rates",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Dashboard metrics"
          }
        }
      }
    },
    "/api/v1/admin/enquiries": {
      "get": {
        "tags": [
          "Admin"
        ],
        "summary": "All Entries: Cross-shop view with filters",
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
            "description": "List of entries across shops"
          }
        }
      }
    },
    "/api/v1/admin/enquiries/{id}/reassign": {
      "patch": {
        "tags": [
          "Admin"
        ],
        "summary": "Reassign enquiry to another employee",
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
                    "type": "string"
                  },
                  "remarks": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Reassigned successfully"
          }
        }
      }
    },
    "/api/v1/admin/enquiries/{id}": {
      "delete": {
        "tags": [
          "Admin"
        ],
        "summary": "Soft-delete an enquiry (is_deleted = 1)",
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
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "reason": {
                    "type": "string"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Soft deleted successfully"
          }
        }
      }
    },
    "/api/v1/admin/shops": {
      "get": {
        "tags": [
          "Admin"
        ],
        "summary": "List all shops",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "includeInactive",
            "in": "query",
            "schema": {
              "type": "boolean",
              "default": false
            }
          }
        ],
        "responses": {
          "200": {
            "description": "List of shops"
          }
        }
      },
      "post": {
        "tags": [
          "Admin"
        ],
        "summary": "Add a new shop branch",
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
            "description": "Shop created"
          }
        }
      }
    },
    "/api/v1/admin/shops/{id}": {
      "patch": {
        "tags": [
          "Admin"
        ],
        "summary": "Edit / rename shop details",
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
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateShopRequest"
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Shop updated"
          }
        }
      },
      "delete": {
        "tags": [
          "Admin"
        ],
        "summary": "Deactivate shop branch (is_active = 0)",
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
            "description": "Shop deactivated"
          }
        }
      }
    },
    "/api/v1/admin/users": {
      "get": {
        "tags": [
          "Admin"
        ],
        "summary": "List all users with their assigned branches",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "includeInactive",
            "in": "query",
            "schema": {
              "type": "boolean",
              "default": false
            }
          }
        ],
        "responses": {
          "200": {
            "description": "List of users"
          }
        }
      },
      "post": {
        "tags": [
          "Admin"
        ],
        "summary": "Create a new employee or admin user",
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
            "description": "User created"
          }
        }
      }
    },
    "/api/v1/admin/users/{id}": {
      "patch": {
        "tags": [
          "Admin"
        ],
        "summary": "Edit user profile and shop assignments",
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
          "content": {
            "application/json": {
              "schema": {
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
                      "EMPLOYEE",
                      "ADMIN"
                    ]
                  },
                  "isActive": {
                    "type": "boolean"
                  },
                  "shopIds": {
                    "type": "array",
                    "items": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "User updated"
          }
        }
      },
      "delete": {
        "tags": [
          "Admin"
        ],
        "summary": "Deactivate user (Immediately blocks login with 403)",
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
            "description": "User deactivated"
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
                    "example": "newpassword123"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Password reset successful"
          }
        }
      }
    },
    "/api/v1/admin/export/csv": {
      "get": {
        "tags": [
          "Admin"
        ],
        "summary": "Download filtered enquiries as CSV",
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
          }
        ],
        "responses": {
          "200": {
            "description": "CSV file download",
            "content": {
              "text/csv": {}
            }
          }
        }
      }
    },
    "/api/v1/super-admin/dashboard": {
      "get": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Platform Overview: Global metrics across all organizations",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Global metrics returned"
          }
        }
      }
    },
    "/api/v1/super-admin/organizations": {
      "get": {
        "tags": [
          "Super Admin"
        ],
        "summary": "List all tenant organizations with shop/user counts",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "includeInactive",
            "in": "query",
            "schema": {
              "type": "boolean",
              "default": false
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Organizations list"
          }
        }
      },
      "post": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Create a new tenant organization (and optional initial Business Admin)",
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
        "summary": "Get organization details with associated shops and staff",
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
          }
        }
      },
      "patch": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Update organization metadata",
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
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/CreateOrganizationRequest"
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
        "summary": "Deactivate organization (Suspends login for all users under this org)",
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
        "summary": "List all Business Admins across all organizations",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "organizationId",
            "in": "query",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Business Admins list"
          }
        }
      },
      "post": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Create a Business Admin for an organization",
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
            "description": "Business Admin created"
          }
        }
      }
    },
    "/api/v1/super-admin/business-admins/{id}": {
      "patch": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Update Business Admin details or reassign organization",
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
            "description": "Business Admin updated"
          }
        }
      },
      "delete": {
        "tags": [
          "Super Admin"
        ],
        "summary": "Delete Business Admin",
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
