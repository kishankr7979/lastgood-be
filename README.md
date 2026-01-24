# Fastify MVC Project with PostgreSQL - Change Events API

A Fastify project following the MVC pattern with PostgreSQL for managing change events across services and environments.

## Project Structure

```
├── config/          # Environment configuration
│   └── environment.ts  # Environment config loader
├── database/        # Database related files
│   ├── connection.ts   # Database connection setup
│   ├── migrations/     # Database migrations
│   │   └── 001_create_change_events_table.sql
│   └── seeds/          # Database seeds
│       └── change_events.sql
├── models/          # Data models and business logic
│   └── ChangeEvent.ts  # Change event model with PostgreSQL operations
├── controllers/     # Request handlers and business logic
│   ├── ChangeEventController.ts  # Change event controller with API endpoints
│   └── RewindController.ts       # Rewind controller for incident analysis
├── views/          # Response formatting and data presentation
│   └── responses.ts # Standardized API response formats
├── routes/         # Route definitions
│   ├── health.ts   # Health check endpoint
│   ├── change-events.ts # Change event CRUD endpoints
│   └── rewind.ts   # Rewind analysis endpoints
├── scripts/        # Utility scripts
│   └── setup-db.ts # Database setup script
└── server.ts       # Main application entry point
```

## Change Events Schema

The `change_events` table stores deployment and infrastructure change events:

```sql
{
  "id": "b3c9e6f2-8d13-4c1a-9e52-7fd8a5a3c912",
  "occurred_at": "2026-01-18T14:31:00Z",
  "service": "api",
  "environment": "prod", 
  "type": "deployment",
  "source": "github",
  "summary": "Deployed api@a8f3c2 by John",
  "meta": {
    "commit": "a8f3c2",
    "author": "john"
  }
}
```

## Available Endpoints

### Health Check
- `GET /health` - Returns server status

### Change Events (with API prefix `/api`)
- `GET /api/change-events` - Get all change events with filtering and pagination
- `GET /api/change-events/stats` - Get change event statistics
- `GET /api/change-events/:id` - Get change event by ID
- `POST /api/change-events` - Create new change event
- `PUT /api/change-events/:id` - Update change event
- `DELETE /api/change-events/:id` - Delete change event

### Rewind Analysis (with API prefix `/api`)
- `GET /api/rewind` - Get change events within a time window before an incident
- `GET /api/rewind/summary` - Get incident analysis summary with risk assessment

### Scoring & Analysis (with API prefix `/api`)
- `GET /api/scoring/incident` - Comprehensive risk analysis for all changes before an incident
- `GET /api/scoring/event/:id` - Score a specific change event against an incident
- `GET /api/scoring/methodology` - Detailed explanation of the scoring methodology

## Rewind API Usage

The rewind endpoints help identify what changes occurred before an incident to assist with root cause analysis.

### GET /api/rewind

Find all change events within a time window before an incident:

```bash
curl "http://localhost:3000/api/rewind?service=api&incidentAt=2026-01-18T14:32:00Z&window=30m"
```

**Query Parameters:**
- `incidentAt` (required) - Incident timestamp in ISO 8601 format
- `window` (optional) - Time window before incident (default: "30m")
  - Format: `{number}{unit}` where unit is `m` (minutes), `h` (hours), or `d` (days)
  - Examples: "30m", "2h", "1d"
- `service` (optional) - Filter by specific service
- `environment` (optional) - Filter by environment
- `limit` (optional) - Limit number of results (1-1000)

**Response includes:**
- All matching change events with time differences from incident
- Events grouped by service and type
- Time range analysis
- Summary statistics

### GET /api/rewind/summary

Get a risk assessment and summary of changes before an incident:

```bash
curl "http://localhost:3000/api/rewind/summary?service=api&incidentAt=2026-01-18T14:32:00Z&window=1h"
```

**Response includes:**
- Risk assessment with score and level (low/medium/high/critical)
- Count of deployments and migrations
- Services and environments affected
- Risk factors analysis

## Query Parameters for GET /api/change-events

- `service` - Filter by service name
- `environment` - Filter by environment (prod, staging, dev)
- `type` - Filter by event type (deployment, migration, etc.)
- `source` - Filter by source (github, manual, etc.)
- `from_date` - Filter events from this date (ISO 8601)
- `to_date` - Filter events until this date (ISO 8601)
- `limit` - Limit number of results (1-1000)
- `offset` - Pagination offset

## API Examples

### Rewind Analysis Examples

```bash
# Find changes in the 30 minutes before an incident
curl "http://localhost:3000/api/rewind?incidentAt=2026-01-18T14:32:00Z&window=30m"

# Find API service changes in the 2 hours before an incident
curl "http://localhost:3000/api/rewind?service=api&incidentAt=2026-01-18T14:32:00Z&window=2h"

# Get risk assessment for production changes before incident
curl "http://localhost:3000/api/rewind/summary?environment=prod&incidentAt=2026-01-18T14:32:00Z&window=1h"
```

### Create Change Event
```bash
curl -X POST http://localhost:3000/api/change-events \
  -H "Content-Type: application/json" \
  -d '{
    "id": "b3c9e6f2-8d13-4c1a-9e52-7fd8a5a3c912",
    "occurred_at": "2026-01-18T14:31:00Z",
    "service": "api",
    "environment": "prod",
    "type": "deployment", 
    "source": "github",
    "summary": "Deployed api@a8f3c2 by John",
    "meta": {
      "commit": "a8f3c2",
      "author": "john"
    }
  }'
```

## Risk Assessment

The rewind summary endpoint provides intelligent risk assessment based on:

- **Recent Deployments** (20 points each) - Recent code deployments
- **Database Migrations** (30 points each) - Schema changes are high risk
- **Timing Proximity** (25 points each) - Changes within 10 minutes of incident
- **Multiple Services** (15 points) - Cross-service impact

**Risk Levels:**
- **Critical** (80+ points) - High likelihood of change-related incident
- **High** (50-79 points) - Significant risk from recent changes
- **Medium** (25-49 points) - Moderate risk
- **Low** (0-24 points) - Minimal risk from recent changes

## Database Setup

### Prerequisites
1. Install PostgreSQL
2. Create a database for the project
3. Update database configuration in `.env`

### Initialize Database
```bash
pnpm run setup-db
```

## Running the Application

```bash
# Setup database (first time only)
pnpm run setup-db

# Development mode
pnpm run dev

# Build and run production
pnpm run build
pnpm start
```

## Features

- **UUID Primary Keys**: Uses PostgreSQL UUID generation
- **JSONB Meta Field**: Flexible metadata storage with GIN indexing
- **Advanced Filtering**: Filter by service, environment, type, source, date ranges
- **Pagination**: Limit and offset support
- **Rewind Analysis**: Time-based incident analysis with risk assessment
- **Statistics**: Get counts and distinct values
- **Validation**: UUID format, date format, and required field validation
- **Indexes**: Optimized for common query patterns

## Scoring & Analysis Engine

The scoring engine provides intelligent risk assessment using a multi-factor algorithm that analyzes change events in relation to incidents.

### GET /api/scoring/incident

Comprehensive analysis of all changes before an incident with individual and overall risk scores:

```bash
curl "http://localhost:3000/api/scoring/incident?incidentAt=2026-01-18T14:32:00Z&service=api&severity=high&window=2h"
```

**Query Parameters:**
- `incidentAt` (required) - Incident timestamp in ISO 8601 format
- `service` (optional) - Service experiencing the incident
- `environment` (optional) - Environment where incident occurred
- `severity` (optional) - Incident severity: critical, high, medium, low
- `description` (optional) - Incident description for context
- `window` (optional) - Analysis time window (default: "2h")
- `limit` (optional) - Limit number of events analyzed

**Response includes:**
- Overall risk assessment with score, level, and explanation
- Individual risk scores for each change event
- Detailed scoring factors and evidence
- Event correlations and compound risks
- Actionable recommendations

### GET /api/scoring/event/:id

Score a specific change event against an incident:

```bash
curl "http://localhost:3000/api/scoring/event/b3c9e6f2-8d13-4c1a-9e52-7fd8a5a3c912?incidentAt=2026-01-18T14:32:00Z&service=api"
```

### Scoring Methodology

The engine uses 5 weighted factors to calculate risk scores:

1. **Timing Proximity (30%)** - How close the change occurred to the incident
2. **Event Type Risk (25%)** - Inherent risk level of the change type
3. **Service Criticality (20%)** - How critical the affected service is
4. **Change Frequency (15%)** - How often changes occur to this service
5. **Blast Radius (10%)** - Potential scope of impact

**Risk Levels:**
- **Critical (80-100)** - Immediate investigation required
- **High (60-79)** - High priority investigation
- **Medium (40-59)** - Should be reviewed
- **Low (0-39)** - Low correlation likelihood

### Scoring Examples

```bash
# Analyze all changes before a critical production incident
curl "http://localhost:3000/api/scoring/incident?incidentAt=2026-01-18T14:32:00Z&environment=prod&severity=critical&window=1h"

# Score a specific deployment against an incident
curl "http://localhost:3000/api/scoring/event/abc123?incidentAt=2026-01-18T14:32:00Z&service=api&severity=high"

# Get detailed scoring methodology
curl "http://localhost:3000/api/scoring/methodology"
```