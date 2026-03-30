# AMSCode(AMS) — Automated Log Monitoring & Observation Platform

> A Domain-Specific Language and full-stack platform for writing, compiling, and deploying real-time log monitoring rules.

---

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Part 1 — AMS-Lang Compiler](#part-1--ams-lang-compiler)
  - [Install Dependencies](#install-dependencies)
  - [Build the Compiler](#build-the-compiler)
  - [Using the Compiler](#using-the-compiler)
- [Part 2 — AMS Platform & IDE](#part-2--ams-platform--ide)
  - [Install Dependencies](#install-platform-dependencies)
  - [Start the IDE & Platform](#start-the-ide--platform)
  - [Using the IDE](#using-the-ide)
  - [Platform Dashboard](#platform-dashboard)
- [AMS-Lang Syntax Guide](#ams-lang-syntax-guide)
- [Example Scripts](#example-scripts)
- [Tech Stack](#tech-stack)
- [License](#license)

---

## Overview

**AutomonScript (AMS-Lang)** is a purpose-built DSL for cybersecurity monitoring and automated threat response. It provides:

- **Human-readable syntax** — Write monitoring rules in plain English-like constructs
- **Pattern-based detection** — Match log patterns, regex, and field conditions
- **Time-windowed correlation** — Detect events occurring N times within a time window
- **Automated response** — Trigger alerts, emails, API calls, IP blocking, and script execution
- **High-performance compilation** — Transpiles `.ams` scripts to native C++ executables
- **Full-featured Platform & IDE** — Professional web and Electron-based desktop IDE, real-time dashboard, log source integration, rule editors, alert routes, and team management tools.

---

## Project Structure

```text
├── ams-lang/                   # Compiler & Language Engine
│   ├── grammar/AMS.g4          # ANTLR4 grammar definition
│   ├── include/ams/            # C++ headers (compiler, runtime, interpreter)
│   ├── src/                    # Compiler source code
│   ├── examples/               # Example .ams scripts
│   ├── build/                  # Build output (ams.exe)
│   ├── CMakeLists.txt          # CMake build configuration
│   ├── install_dependency.ps1  # Dependency installer
│   └── ams_install_windows.ps1 # Build script
│
├── IDE/                        # Full-Stack Platform & IDE
│   ├── server/                 # Node.js/Express backend + Prisma & WebSocket
│   │   └── src/
│   │       ├── index.ts        # Express server
│   │       ├── routes/         # API endpoints (auth, fs, rules, alerts)
│   │       └── lib/            # Prisma client
│   ├── client/                 # React + Vite frontend
│   │   ├── electron/           # Electron shell integration
│   │   └── src/
│   │       ├── App.tsx         # Platform layout & routing
│   │       ├── components/     # UI components (Editor, AST, Dashboard)
│   │       ├── pages/          # Full-stack pages (Projects, Logsources, Alerts)
│   │       └── hooks/          # Custom React hooks
│   ├── start-dev.bat           # Web-based dev startup
│   └── start-electron.bat      # Electron desktop launch
│
└── README.md
```

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | ≥ 18.x | IDE backend & frontend |
| **npm** | ≥ 9.x | Package management |
| **CMake** | ≥ 3.20 | Compiler build system |
| **MSVC / GCC** | C++17 | Compiler compilation |
| **Java JRE** | ≥ 11 | ANTLR4 parser generation |
| **PowerShell** | 5.1+ | Build scripts (Windows) |
| **Electron** | *Auto-installed* | Desktop app shell |
| **Prisma / PostgreSQL** | *Auto-installed* | Backend database |

---

## Getting Started
In the `AMScode/IDE` folder:
### Environment Setup
Create a .env file in the `IDE/` and make sure to change `user` and `password` fields:
```
DB_USER=user
DB_PASSWORD=password
DB_NAME=ams_db
DATABASE_URL=postgresql://user:password@localhost:5432/ams_db?schema=public
PRISMA_CLIENT_ENGINE_TYPE=binary
PRISMA_CLI_QUERY_ENGINE_TYPE=binary
```

### Build and Launch
Only for first time usage or after making changes to the codebase:
```bash
docker-compose up --build
```

### Run
Once the images are built:
```bash
docker-compose up
```

### Stop
Stop the containers while keeping images:
```bash
docker-compose stop
```
stop and remove the containers:
```bash
docker-compose down
```
### Note
- For persistent storage database records are stored in `postgres_data` folder on host.

## Part 1 — AMS-Lang Compiler

### Install Dependencies

Open **PowerShell** in the `ams-lang/` directory:

```powershell
cd ams-lang
.\install_dependency.ps1
```

This installs ANTLR4, vcpkg packages, and other build dependencies.

### Build the Compiler

```powershell
.\ams_install_windows.ps1
```

This generates the ANTLR parser from `AMS.g4`, compiles the C++ source, and produces `build/ams.exe`.

### Using the Compiler

After building, the `ams` command is available:

```powershell
# View help and available commands
ams

# Run a script in interpreted mode
ams run .\examples\hello_world.ams

# Compile a script to a native executable
ams build .\examples\brute_force.ams

# Run the compiled executable
.\examples\brute_force.exe
```

#### Available Example Scripts

| Script | Description |
|--------|-------------|
| `hello_world.ams` | Basic syntax demonstration |
| `brute_force.ams` | Detects repeated failed logins |
| `sql_injection.ams` | Monitors for SQL injection patterns |
| `multi_rule.ams` | Multiple rules in a single script |
| `advanced_monitoring.ams` | Complex rules with severity levels, regex, and multiple actions |

---

## Part 2 — AMS Platform & IDE

The IDE is a full-stack platform providing a professional slate-blue interface for writing, compiling, monitoring, and managing AMS-Lang scripts, available as a web app or an Electron desktop application.

### Install Platform Dependencies

```powershell
# Install backend dependencies
cd IDE\server
npm install

# Install frontend dependencies
cd ..\client
npm install
```

### Start the IDE & Platform

You can run the IDE platform either as a local Web Application or as an Electron Desktop App.

**Option A: Web Mode**
Use the `start-dev.bat` script to launch both the backend and frontend dev servers automatically. You can also run them manually:
```powershell
# Terminal 1 — Backend (Port 3001)
cd IDE\server
npm run dev

# Terminal 2 — Frontend (Port 5173)
cd IDE\client
npx vite --port 5173
```
Then open your browser to: **http://localhost:5173**

**Option B: Electron Desktop Mode**
Use the `start-electron.bat` launcher located in the `IDE/` folder.
This script will synchronize the Prisma database schema, check/install Electron dependencies, start the backend server, run Vite, and launch the Electron desktop window all at once:
```powershell
cd IDE
.\start-electron.bat
```

### Using the IDE

#### Editor View
- **File Explorer** (Left Sidebar) — Browse, create, and open `.ams` files from the project. Fully resizable.
- **Monaco Editor** (Center) — Edit code with full AMS syntax highlighting, autocomplete, and error diagnostics from the compiler.
- **AST Panel** (Right Sidebar) — Live Abstract Syntax Tree visualization that updates as you type. Fully resizable horizontally.
- **Output Terminal** (Bottom) — View real-time compilation output, progress, and errors. Fully resizable vertically.
- **Toolbar Menu** — Top-level actions such as compiling the active script (`ams.exe` execution), saving, or navigating the platform.

### Platform Dashboard

Beyond the code editor, the platform provides managed views:
- **Projects & Team Management**: Organize monitoring projects and manage team access.
- **Log Sources Management**: Configure where logs stream from (e.g., Elasticsearch, local JSON, Splunk endpoints).
- **Rules Editor**: No-code/low-code interface that works directly alongside `.ams` scripts.
- **Alert Routes**: Route specific event triggers to Slack, PagerDuty, Email, or Webhooks.
- **Real-Time Dashboard**: View active incoming event streams, rule hit frequencies, and server utilization metrics.

#### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Save current file |
| `Ctrl + Shift + B` | Compile current file |
| `Ctrl + Space` | Trigger autocomplete |

---

## AMS-Lang Syntax Guide

### Basic Structure

```
// Comments start with //

MONITOR "logfile.log"           // Specify log source
WATCH json "data.json"          // Watch a JSON data source
SET threshold = 5               // Define variables

RULE RuleName SEVERITY HIGH     // Define a named rule
WHEN "PATTERN"                  // Pattern to match
OCCURS 5 TIMES IN 10 MINUTES   // Time-windowed detection
IF field == "value"             // Optional field condition
DO
    ALERT("Alert message")      // Trigger actions
    SEND_EMAIL("admin@co.com")
    LOG("output.log")
    BLOCK_IP("192.168.1.100")
END
```

### Keywords Reference

| Category | Keywords |
|----------|----------|
| **Sources** | `MONITOR`, `WATCH` (json, csv, html) |
| **Variables** | `SET` |
| **Rules** | `RULE`, `SEVERITY` (LOW, MEDIUM, HIGH, CRITICAL) |
| **Detection** | `WHEN`, `AND`, `OR`, `NOT`, `regex()` |
| **Time Windows** | `OCCURS`, `TIMES`, `IN`, `WITHIN`, `MINUTES`, `SECONDS`, `HOURS` |
| **Flow** | `IF`, `DO`, `END` |
| **Actions** | `ALERT`, `SEND_EMAIL`, `LOG`, `CALL_API`, `EXECUTE_SCRIPT`, `CONSOLE`, `BLOCK_IP` |
| **Operators** | `==`, `!=`, `>`, `<`, `>=`, `<=`, `AND`, `OR`, `NOT` |

---

## Example Scripts

### Brute Force Detection
```
MONITOR "auth.log"

RULE BruteForceDetection
WHEN "FAILED_LOGIN"
OCCURS 5 TIMES IN 10 MINUTES
DO
    SEND_EMAIL("security@company.com")
    LOG("alerts.log")
    ALERT("Brute force attack detected!")
END
```

### SQL Injection Monitoring
```
MONITOR "query.log"

RULE SQLInjectionDetection
WHEN regex("(SELECT|INSERT|UPDATE|DELETE).*('|;|--)")
DO
    ALERT("SQL injection attempt detected")
    BLOCK_IP("source_ip")
END
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **DSL Grammar** | ANTLR4 |
| **Compiler** | C++17 (MSVC / GCC) |
| **Build System** | CMake |
| **Platform Backend** | Node.js, Express, Prisma, TypeScript |
| **Platform Frontend**| React 18, Vite, TypeScript |
| **Code Editor** | Monaco Editor |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **Real-time** | WebSockets |
| **Compile Streaming** | Server-Sent Events (SSE) |
| **Desktop** | Electron |
| **Database** | PostgreSQL (via Prisma) |

---

## License

See [LICENSE](ams-lang/LICENSE) for details.
