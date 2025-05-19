# Alloy Demo Application

A desktop application for demonstrating Alloy's identity verification platform.

## For Users

### Installation

1. Download the latest version for your operating system:
   - Windows: Download the `.exe` installer
   - Mac: Download the `.dmg` file
   - Linux: Download the `.AppImage` or `.deb` file

2. Install the application:
   - Windows: Run the installer and follow the prompts
   - Mac: Open the `.dmg` file and drag the app to your Applications folder
   - Linux: Double-click the `.AppImage` file or install the `.deb` package

3. Launch the application from your applications menu or desktop shortcut

### First-Time Setup

1. When you first launch the app, you'll be prompted to enter your Alloy credentials
2. Enter your:
   - SDK Key
   - Journey Token
   - API Token
   - API Secret
   - Base URL
3. Click "Save Configuration" to continue

### Using the Application

- Add persons or businesses to verify
- Fill in the required information
- Submit applications for verification
- View results in real-time
- Access previous applications through the dashboard links

## For Developers

### Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

### Building the Application

Build for all platforms:
```bash
npm run dist
```

Or build for specific platforms:
```bash
npm run build:mac    # Build for macOS
npm run build:win    # Build for Windows
npm run build:linux  # Build for Linux
```

The built applications will be available in the `dist` folder.

### Development Notes

- The application uses Electron for the desktop wrapper
- Express.js handles the backend API
- Configuration is stored securely using electron-store
- All API calls to Alloy are made through the backend for security

---

## Requirements

- **Node.js** (v16+ recommended)
- **npm** (v8+ recommended)
- **Alloy API credentials** (Token, Secret, SDK Key, Journey Token)
- Internet connection (for CDN assets and Alloy SDK)

---

## Features

- Dynamic application form for persons, businesses, and representatives
- Sandbox Profiles: trigger specific Alloy sandbox scenarios
- Pre-fill Dummy Data: generate realistic sample data with Faker
- Add/remove persons, businesses, and representatives dynamically
- Modern, responsive UI with Bootstrap and FontAwesome
- Smooth animations for modals and forms (fade, slide-in/out)
- Developer Mode: view API requests and responses
- Full validation with scroll-to-error and real-time feedback
- Alloy SDK integration for step-up verification

---

## Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd 2025-demo-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Alloy credentials:**
   - On first run, you'll be prompted for:
     - Alloy Token
     - Alloy Secret
     - Alloy SDK Key
     - Alloy Journey Token
   - These will be stored in a `.env` file (never commit this file).

4. **Start the application:**
   ```bash
   npm start
   ```
   - The app will be available at [http://localhost:3000](http://localhost:3000)

---

## Usage

1. **Fill out the application form:**
   - Add persons, a business, and representatives as needed.
   - Use "Pre-fill Dummy Data" to auto-populate empty fields (fields set by Sandbox Profiles are protected).
   - Use Sandbox Profiles to trigger Alloy sandbox scenarios for specific persons.

2. **Validation:**
   - The form validates all required fields.
   - On submit, the page scrolls to the first invalid field if any are missing or incorrect.

3. **Submit the application:**
   - The request is sent to Alloy and the response is shown in Developer Mode.
   - If step-up verification is required, the Alloy SDK is automatically launched.

4. **Developer Mode:**
   - Toggle Developer Mode to view the raw API request and response.

---

## Security Notes

- The `.env` file contains sensitive credentials. **Never commit this file to version control.**
- Add `.env` to your `.gitignore` file.
- Keep your Alloy credentials secure.

---

## Dependencies

- Express.js
- Axios
- Faker.js
- Bootstrap 5
- FontAwesome
- Alloy SDK (via CDN)

---

## Customization & Development

- All UI logic is in `public/index.html` and `public/css/styles.css`.
- Animations and transitions are handled via reusable CSS classes.
- You can extend the form, add new fields, or customize the UI as needed.

---

## Support

For Alloy API or SDK questions, visit [alloy.com](https://www.alloy.com/) or contact Alloy support. 