# Product Requirements Document (PRD)
## Service Hub UI - Container Service Management System

**Version:** 1.0  
**Date:** November 8, 2025  
**Document Owner:** Development Team  
**Status:** Implemented

---

## Executive Summary

The Service Hub UI is a comprehensive container service management system built as a full-stack web application. It provides end-to-end management of container fleets, including real-time monitoring, automated service scheduling, WhatsApp-based customer communication, and AI-powered RAG (Retrieval-Augmented Generation) chat assistance for diagnostics.

**Key Features:**
- Container fleet management with IoT integration via Orbcomm
- Automated alert detection and classification
- Real-time dashboards with role-based access
- WhatsApp Business API integration for customer communication
- AI-powered service scheduling and optimization
- Technician management and tracking
- Inventory management with reorder alerts
- RAG-powered diagnostic chat assistant
- Comprehensive analytics and reporting

---

## 1. Product Overview

### 1.1 Product Vision
A unified platform for intelligent container service management that combines IoT monitoring, AI automation, and seamless communication to optimize service delivery and customer experience.

### 1.2 Business Objectives
- Provide real-time visibility into container fleet health
- Automate service request workflows
- Enable proactive maintenance through predictive analytics
- Streamline customer communication via WhatsApp
- Optimize technician scheduling and resource allocation
- Maintain comprehensive service history and analytics

### 1.3 Scope

**Core Features:**
- Container tracking and monitoring (IoT + Manual)
- Automated alert system
- Service request management
- Technician scheduling and management
- Customer communication via WhatsApp
- Inventory management
- RAG-powered diagnostic assistance
- Real-time analytics and reporting

---

## 2. User Personas

### 2.1 Admin/Super Admin
- Full system access
- Fleet overview and analytics
- User management
- System configuration

### 2.2 Coordinator
- Service request management
- Technician assignment
- Customer communication
- Inventory oversight

### 2.3 Technician
- Service request execution
- Location tracking
- WhatsApp communication
- Inventory access

### 2.4 Client/Customer
- Container monitoring
- Service request submission
- WhatsApp notifications
- Billing and history access

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                           │
├─────────────────────────────────────────────────────────────┤
│  React SPA with Role-Based Routing and Real-time Updates    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     API Layer                                │
│              (Express.js with Authentication)                │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Business Logic Layer                       │
├──────────────┬───────────────┬──────────────┬───────────────┤
│ Container    │ Service       │ Scheduling   │ Communication │
│ Management   │ Management    │ Engine       │ Engine        │
└──────────────┴───────────────┴──────────────┴───────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    AI/ML Services Layer                      │
├──────────────┬───────────────┬──────────────┬───────────────┤
│ RAG Chat     │ Alert         │ Route        │ Predictive    │
│ Assistant    │ Classifier    │ Optimizer    │ Maintenance   │
└──────────────┴───────────────┴──────────────┴───────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Integration Layer                         │
├──────────────┬───────────────┬──────────────┬───────────────┤
│ Orbcomm IoT  │ WhatsApp      │ Qdrant       │ Neon          │
│ API          │ Business API  │ Vector DB    │ PostgreSQL    │
└──────────────┴───────────────┴──────────────┴───────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
├──────────────┬───────────────┬──────────────┬───────────────┤
│ PostgreSQL   │ Qdrant        │ File Storage │ Redis Cache   │
│ (Primary DB) │ (Vectors)     │ (Uploads)    │ (Sessions)    │
└──────────────┴───────────────┴──────────────┴───────────────┘
```

### 3.2 Technology Stack

**Frontend:**
- React 18 with TypeScript
- Wouter for routing
- TailwindCSS + Radix UI components
- TanStack Query for state management
- WebSocket for real-time updates

**Backend:**
- Node.js with Express.js
- TypeScript
- Drizzle ORM for database
- Passport.js for authentication
- Multer for file uploads

**Database:**
- Neon PostgreSQL (Primary)
- Qdrant Vector Database (RAG)
- Redis for caching

**AI/ML:**
- Google Generative AI
- LangChain for RAG
- Xenova Transformers

**Integrations:**
- WhatsApp Business API
- Orbcomm IoT Platform
- OpenAI API (optional)

**Infrastructure:**
- Vite for development/build
- PM2 for production deployment
- Docker support

---

## 4. Functional Requirements

### 4.1 Authentication & Authorization
- User registration and login
- Role-based access control (admin, coordinator, technician, client, super_admin)
- Session management
- API authentication via x-user-id header

### 4.2 Container Management
- Container registration and profiling
- Real-time location tracking via IoT
- Service history and maintenance logs
- Container assignment to customers
- Status monitoring (active, inactive, maintenance)
- IoT-enabled container metrics

### 4.3 Alert System
- Automated alert generation from IoT data
- Alert classification by severity (critical, high, medium, low)
- Alert acknowledgment and resolution workflow
- Real-time notifications
- Alert filtering and search

### 4.4 Service Request Management
- Service request creation (manual/auto)
- Priority-based assignment
- Status tracking (pending, assigned, in-progress, completed, cancelled)
- Timeline and audit trail
- Technician assignment and scheduling

### 4.5 Technician Management
- Technician profiles with skills and location
- Performance tracking and analytics
- Schedule management
- Real-time location updates
- Wage and allowance management

### 4.6 Customer Management
- Customer profiles and contact information
- Container ownership tracking
- Service history access
- Communication preferences

### 4.7 WhatsApp Integration
- Automated customer notifications
- Interactive messages (buttons, lists, templates)
- Media and document sharing
- Critical alert broadcasting
- Technician-customer communication

### 4.8 AI Scheduling
- Intelligent route optimization
- Skill-based technician assignment
- Time and distance optimization
- Constraint-based scheduling

### 4.9 Inventory Management
- Parts catalog and stock tracking
- Reorder alerts and notifications
- Stock adjustments and transactions
- Category-based organization
- Search and filtering

### 4.10 RAG Chat Assistant
- Document ingestion and processing
- Vector-based semantic search
- Context-aware responses
- Diagnostic assistance
- Knowledge base management

### 4.11 Analytics & Reporting
- Real-time dashboards
- KPI tracking (response times, completion rates, etc.)
- Service analytics
- Inventory reports
- Technician performance metrics

### 4.12 File Management
- Manual/document upload
- PDF processing for RAG
- Secure file storage
- Access control for uploads

---

## 5. Technical Requirements

### 5.1 Performance
- Page load time < 2 seconds
- API response time < 500ms
- Support for 1000+ concurrent users
- Real-time updates with < 1 second latency

### 5.2 Scalability
- Horizontal scaling support
- Database connection pooling
- Caching layer implementation
- CDN integration for static assets

### 5.3 Security
- HTTPS encryption
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Rate limiting
- Audit logging

### 5.4 Reliability
- 99.9% uptime target
- Automatic error recovery
- Database backup and recovery
- Monitoring and alerting

---

## 6. Integration Requirements

### 6.1 WhatsApp Business API
- Message templates and approval
- Webhook handling for incoming messages
- Media upload and download
- Interactive message support

### 6.2 Orbcomm IoT Platform
- Device data polling
- Real-time data streaming
- Device management
- API authentication

### 6.3 Vector Database (Qdrant)
- Vector storage and retrieval
- Similarity search
- Collection management
- High availability

---

## 7. AI/ML Components

### 7.1 RAG System
- Document chunking and embedding
- Vector similarity search
- Context retrieval
- Response generation using LLMs

### 7.2 Alert Classification
- Automated severity assessment
- Pattern recognition
- Predictive maintenance alerts

### 7.3 Scheduling Optimization
- Route optimization algorithms
- Resource allocation
- Time estimation

---

## 8. Data Model

### 8.1 Core Entities

**Users**
- id (varchar, primary key)
- phone_number (text, unique)
- name (text)
- email (text)
- role (enum: admin, client, technician, coordinator, super_admin)
- password (text)
- is_active (boolean)
- whatsapp_verified (boolean)
- email_verified (boolean)
- created_at, updated_at (timestamps)

**Containers**
- id (varchar, primary key)
- container_id (text, unique)
- type (enum: refrigerated, dry, special, iot_enabled, manual)
- manufacturer, model, capacity (text)
- status (enum: active, in_service, maintenance, retired, in_transit, for_sale, sold)
- has_iot (boolean)
- orbcomm_device_id (text)
- current_location (jsonb)
- assigned_client_id (foreign key to customers)
- assignment_date, expected_return_date (timestamps)
- manufacturing_date, purchase_date, last_sync_time (timestamps)
- health_score, usage_cycles (integers)
- excel_metadata (jsonb)
- created_at, updated_at (timestamps)

**Service Requests**
- id (varchar, primary key)
- request_number (text, unique)
- container_id (foreign key)
- client_id (foreign key)
- alert_id (foreign key, optional)
- assigned_technician_id (foreign key, optional)
- priority (enum: urgent, high, normal, low)
- status (enum: pending, approved, scheduled, in_progress, completed, cancelled)
- issue_description (text)
- required_parts (text array)
- estimated_duration (integer)
- requested_at, approved_at, scheduled_date, started_at, completed_at (timestamps)
- service_duration, total_cost (numeric)
- service_notes (text)
- used_parts (text array)
- before_photos, after_photos (text arrays)
- client_approval_required (boolean)
- client_approved_at (timestamp)
- created_by (foreign key)
- created_at, updated_at (timestamps)

**Alerts**
- id (varchar, primary key)
- alert_code (text)
- container_id (foreign key)
- alert_type (enum: error, warning, info, temperature, power, connectivity, door, system)
- severity (enum: critical, high, medium, low)
- source (enum: orbcomm, manual, predictive)
- title, description (text)
- ai_classification (jsonb)
- error_code (text)
- detected_at (timestamp)
- acknowledged_at, resolved_at (timestamps, optional)
- acknowledged_by, service_request_id (foreign keys, optional)
- resolution_method (enum: auto, service, diy, ignored)
- resolution_steps, required_parts (text arrays)
- estimated_service_time (integer)
- metadata (jsonb)
- created_at (timestamp)

**Technicians**
- id (varchar, primary key)
- user_id (foreign key)
- tech_number (text, unique)
- experience_level (text)
- skills (text array)
- home_location, service_areas (jsonb, text array)
- status (enum: available, on_duty, busy, off_duty)
- average_rating, total_jobs (integers)
- created_at (timestamp)

**Customers**
- id (varchar, primary key)
- user_id (foreign key)
- company_name, contact_person, email, phone, whatsapp_number (text)
- customer_tier (enum: premium, standard, basic)
- payment_terms (enum: prepaid, net15, net30)
- billing_address, shipping_address, gstin (text)
- account_manager_id (foreign key, optional)
- status (enum: active, inactive, suspended)
- created_at, updated_at (timestamps)

**WhatsApp Messages**
- id (varchar, primary key)
- recipient_type (enum: customer, technician, admin)
- recipient_id (varchar)
- phone_number (text)
- message_type (enum: text, template, interactive, media, flow)
- template_name (text, optional)
- message_content (jsonb)
- whatsapp_message_id (text, unique)
- status (enum: sent, delivered, read, failed)
- sent_at, delivered_at, read_at (timestamps, optional)
- failed_reason (text, optional)
- conversation_id (foreign key, optional)
- related_entity_type, related_entity_id (text, varchar)
- created_at (timestamp)

**Inventory**
- id (varchar, primary key)
- part_number (text, unique)
- part_name, category (text)
- quantity_in_stock, reorder_level (integers)
- unit_price (numeric)
- location (text)
- created_at, updated_at (timestamps)

**Container Metrics**
- id (varchar, primary key)
- container_id (foreign key)
- timestamp (timestamp)
- location, temperature, humidity, power_status, door_status, battery_level, signal_strength, error_codes, raw_data (various)

### 8.2 Key Relationships
- Containers belong to Customers (assigned_client_id)
- Service Requests reference Containers, Customers, Technicians, Alerts
- Alerts link to Containers and Service Requests
- WhatsApp Messages connect to various entities via related_entity_type/id
- Technicians and Customers link to Users
- All entities have proper foreign key constraints

---

## 9. User Flows

### 9.1 Container Issue Resolution Flow
1. IoT sensor detects anomaly → Alert generated
2. Alert classified and notified to coordinator
3. Service request created and assigned to technician
4. Technician notified via WhatsApp with details
5. Technician arrives, updates status
6. Service completed, customer notified
7. Feedback collected, invoice generated

### 9.2 Customer Service Request Flow
1. Customer reports issue via portal or WhatsApp
2. Service request logged with priority assessment
3. Technician assigned via AI scheduling
4. Real-time updates provided to customer
5. Service completion and payment processing

---

## 10. Implementation Status

### 10.1 Completed Features
- ✅ Full-stack application architecture
- ✅ User authentication and role management
- ✅ Container management system
- ✅ Alert detection and management
- ✅ Service request workflow
- ✅ Technician management
- ✅ WhatsApp integration
- ✅ Orbcomm IoT integration
- ✅ RAG chat assistant
- ✅ Inventory management
- ✅ Real-time dashboards
- ✅ Analytics and reporting

### 10.2 Production Readiness
- ✅ Database schema optimization
- ✅ Error handling and logging
- ✅ Security implementation
- ✅ API documentation
- ✅ Testing framework setup
- ✅ Deployment configuration

---

## 11. API Endpoints Summary

The system exposes 50+ REST API endpoints covering:
- Dashboard statistics and analytics
- Container CRUD operations and monitoring
- Alert management and notifications
- Service request lifecycle management
- Technician scheduling and tracking
- WhatsApp messaging and templates
- Inventory operations
- RAG knowledge base queries
- Orbcomm device integration

---

## 12. Deployment & Maintenance

### 12.1 Development Environment
- Local development with Vite
- Hot reload and debugging
- Environment-based configuration

### 12.2 Production Deployment
- Docker containerization
- PM2 process management
- Database migrations
- SSL certificate management

### 12.3 Monitoring
- Application performance monitoring
- Error tracking and alerting
- Database health checks
- Integration status monitoring

---

This PRD represents the current implemented state of the Service Hub UI system, providing a comprehensive container service management platform with AI-powered features and seamless integrations.
