# Hospital Shift Scheduler

A HIPAA-compliant hospital shift scheduling system with First-Come, First-Served (FCFS) distribution, real-time notifications, and comprehensive staff management.

## Features

- **FCFS Shift Distribution**: Fair shift allocation with 15-minute response windows
- **Real-time Updates**: WebSocket-based notifications for instant updates
- **Multi-channel Notifications**: Email, SMS, push, and in-app alerts
- **HIPAA Compliance**: Comprehensive security with audit logging
- **Role-based Access**: Admin, supervisor, and staff roles
- **Mobile-Responsive**: Optimized for healthcare workers on the go
- **Fatigue Management**: Track consecutive hours and suggest rest periods
- **Skill-based Matching**: Assign shifts based on certifications and skills

## Tech Stack

- **Frontend**: React, Material-UI, Redux
- **Backend**: Node.js, Express, Socket.io
- **Database**: SQL Server Express
- **Cache**: Redis
- **Authentication**: Auth0 with MFA
- **Deployment**: IIS on Windows Server

## Installation

### Prerequisites

- Node.js 16+
- SQL Server Express
- Redis
- IIS with iisnode module (for production)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/Skeptic1222/hospital-shift-scheduler.git
cd hospital-shift-scheduler
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
npm run db:migrate
npm run db:seed
```

5. Start development server:
```bash
npm run dev
```

## Development

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with hot reload
- `npm test` - Run tests
- `npm run build` - Build for production
- `npm run lint` - Run ESLint

### Demo Mode

Run with demo data (no external services required):
```bash
export DEMO_MODE=true
export SKIP_EXTERNALS=true
npm run demo
```

### Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.hospital.com | Admin123! |
| Supervisor | supervisor@demo.hospital.com | Super123! |
| Nurse | nurse1@demo.hospital.com | Nurse123! |

## Deployment

### IIS Deployment

Deploy using PowerShell (requires Administrator):
```powershell
.\deploy.ps1 -Environment production -SqlServer ".\SQLEXPRESS" -IISAppName "HospitalScheduler" -Port 3001
```

### Docker Deployment

```bash
docker-compose up -d
```

## Configuration

### Environment Variables

Key environment variables:

- `AUTH0_DOMAIN` - Auth0 domain
- `DB_SERVER` - SQL Server instance
- `REDIS_HOST` - Redis server
- `JWT_SECRET` - JWT signing secret
- `ALLOWED_ORIGINS` - CORS origins

See `.env.example` for full list.

### FCFS Algorithm Configuration

The shift distribution uses weighted priorities:
- Seniority: 30%
- Last Shift Worked: 20%
- Skill Match: 25%
- Availability: 25%

## API Documentation

API documentation available at `/api/docs` when running in development mode.

## Security

- AES-256 encryption for data at rest
- TLS 1.2+ for data in transit
- Automatic session timeout (15 minutes)
- Comprehensive audit logging
- Role-based access control
- Multi-factor authentication

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions, please use the [GitHub Issues](https://github.com/Skeptic1222/hospital-shift-scheduler/issues) page.

## Acknowledgments

- Built with React and Material-UI
- Real-time features powered by Socket.io
- HIPAA compliance consulting by healthcare IT experts