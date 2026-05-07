# Vibe Marketing Backend

FastAPI backend for Vibe Marketing platform with Google OAuth authentication and X AI integration.

## Features

- **Authentication**: Google OAuth with JWT token management
- **X Agent API**: Analyze keywords on X (Twitter) platform
  - Trending topics analysis
  - Sentiment analysis
  - Comprehensive analysis
- **User Management**: User profiles and activity tracking
- **History Tracking**: Store and retrieve analysis history
- **API Documentation**: Auto-generated with Swagger/OpenAPI

## Tech Stack

- **Framework**: FastAPI
- **Database**: SQLite (development) / PostgreSQL (production)
- **Caching**: Redis
- **Authentication**: Google OAuth 2.0 + JWT
- **AI Integration**: X AI API

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry point
│   ├── config.py               # Application configuration
│   ├── database.py             # Database connection and session
│   ├── models.py               # SQLAlchemy models
│   ├── schemas.py              # Pydantic schemas
│   ├── auth/
│   │   ├── __init__.py
│   │   ├── routes.py          # Authentication endpoints
│   │   ├── google_oauth.py    # Google OAuth logic
│   │   └── jwt_handler.py     # JWT token management
│   ├── api/
│   │   ├── x_agent/
│   │   │   ├── __init__.py
│   │   │   └── routes.py      # X agent API endpoints
│   │   └── other_agents/      # Reserved for future agents
│   ├── services/
│   │   ├── __init__.py
│   │   └── xai_service.py    # X AI API integration
│   └── middleware/
│       ├── __init__.py
│       └── auth.py            # Authentication middleware
├── tests/                     # Test files
├── logs/                      # Application logs
├── requirements.txt           # Python dependencies
├── .env.example              # Environment variables template
├── docker-compose.yml        # Docker Compose configuration
├── Dockerfile                # Docker image
├── run.py                    # Application runner
└── FRONTEND_INTEGRATION.md   # Frontend integration guide
```

## Installation

### Prerequisites

- Python 3.11+
- pip

### Setup

1. Clone the repository:
```bash
cd /Users/johnstills/Documents/Vibe\ Marckrting/backend
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Run the application:
```bash
python run.py
```

The API will be available at `http://localhost:8000`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 8000 |
| `DEBUG` | Debug mode | True |
| `DATABASE_URL` | Database connection string | `sqlite:///./vibe_marketing.db` |
| `SECRET_KEY` | JWT secret key | - |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | - |
| `XAI_API_KEY` | X AI API Key | - |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:3000` |

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with email and password |
| POST | `/api/auth/register` | Register with email and password |
| GET | `/api/auth/google` | Google OAuth placeholder |
| POST | `/api/auth/google/login` | Login with Google OAuth token |
| GET | `/api/auth/google/auth-url` | Get Google OAuth authorization URL |

### X Agent

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/x-agent/analyze` | Analyze keyword on X platform |
| GET | `/api/v1/x-agent/history` | Get user's analysis history |
| GET | `/api/v1/x-agent/trending` | Get trending topics |

### Documentation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/docs` | Swagger UI documentation |
| GET | `/redoc` | ReDoc documentation |
| GET | `/openapi.json` | OpenAPI schema |

## Docker Deployment

### Using Docker Compose

```bash
docker-compose up -d
```

This will start:
- FastAPI backend on port 8000
- PostgreSQL database on port 5432
- Redis cache on port 6379

### Using Docker

```bash
docker build -t vibe-marketing-backend .
docker run -p 8000:8000 vibe-marketing-backend
```

## Development

### Database Migrations

```bash
# Generate migration
alembic revision --autogenerate -m "migration message"

# Apply migration
alembic upgrade head
```

### Running Tests

```bash
pytest tests/
```

### Code Style

The project follows PEP 8 style guidelines. Use black for formatting:

```bash
black app/
```

## Production Deployment

### Security Checklist

- [ ] Set strong `SECRET_KEY`
- [ ] Use PostgreSQL instead of SQLite
- [ ] Enable HTTPS
- [ ] Set `DEBUG=False`
- [ ] Enable authentication middleware
- [ ] Use environment-specific config
- [ ] Set up rate limiting
- [ ] Configure proper CORS origins

### Recommended Hosting

- **Vercel / Railway**: Easy deployment
- **AWS / GCP / Azure**: Full control
- **DigitalOcean / Linode**: Cost-effective

## License

Proprietary - Vibe Marketing

## Support

For support, please contact the development team.