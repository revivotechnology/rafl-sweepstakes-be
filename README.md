# 🎉 Rafl Sweepstakes Backend

Shopify Giveaway App - Express.js + MongoDB

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+ recommended)
- MongoDB (running locally or MongoDB Atlas)

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Create environment file:**
Create a `.env` file in the root directory:
```bash
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://localhost:27017/rafl-sweepstakes
```

3. **Start MongoDB locally (if using local instance):**
```bash
# On Ubuntu/Debian
sudo systemctl start mongod

# On macOS with Homebrew
brew services start mongodb-community
```

### Running the Application

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:4000`

## 📁 Project Structure

```
rafl-sweepstakes-be/
├── src/
│   ├── config/
│   │   └── database.js       # MongoDB connection
│   ├── controllers/          # Route handlers (coming soon)
│   ├── models/               # Mongoose schemas (coming soon)
│   ├── routes/               # API routes (coming soon)
│   ├── services/             # Business logic (coming soon)
│   ├── middleware/           # Custom middleware (coming soon)
│   ├── utils/                # Helper functions (coming soon)
│   └── server.js             # Express app entry point
├── .env                      # Environment variables (create this)
├── .env.example              # Environment template
├── .gitignore
├── package.json
└── README.md
```

## 🧪 Test the Setup

After starting the server, test these endpoints:

**Root endpoint:**
```bash
curl http://localhost:4000/
```

**Health check:**
```bash
curl http://localhost:4000/health
```

## 📋 Next Steps

- [ ] Set up Mongoose models (Store, Entry, Winner)
- [ ] Implement Shopify OAuth
- [ ] Create webhook handlers
- [ ] Build merchant dashboard APIs
- [ ] Add JWT authentication
- [ ] Implement winner selection logic

## 🛠️ Technologies

- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - MongoDB ODM
- **dotenv** - Environment configuration
- **nodemon** - Development auto-reload

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 4000 |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/rafl-sweepstakes |

## 🐛 Troubleshooting

**MongoDB Connection Error:**
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env` is correct
- For local MongoDB: `sudo systemctl status mongod`

**Port Already in Use:**
- Change `PORT` in `.env` to another port (e.g., 5000)
- Or kill the process using port 4000

## 📚 Resources

- [Express.js Docs](https://expressjs.com/)
- [Mongoose Docs](https://mongoosejs.com/)
- [MongoDB Docs](https://www.mongodb.com/docs/)
- [Shopify API Docs](https://shopify.dev/docs/api)

