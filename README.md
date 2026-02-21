# Clawmni OS

A purpose-built, agentic Operating System that uses **Firebase Realtime Database** as its live "Bloodstream" and **GitHub** as its "Long-Term Memory". 

Built for consistent, long-term autonomous execution without context-window limitations. Powered by the [Minimax M2.5](https://api.minimax.io) cognitive model.

---

## 🧠 System Architecture

Clawmni OS mimics biological systems to handle asynchronous, long-running agent tasks. In V2, the system uses a **Blood Pressure** mechanic to dynamically throttle API usage and subagent scaling based on your specific limits.

### 1. The Bloodstream (Firebase) & Blood Pressure
Every component of the OS communicates through Firebase Realtime Database. Live states, chemical levels (Cortisol/Dopamine), target repository configurations, and current goals are all streamed to and from `https://clawmni-default-rtdb.firebaseio.com/`.

**Blood Pressure (The Throttle):**
The Bloodstream constantly monitors the balance of four metrics: Ideas, Tasks, Issues, and remaining "Fuel" (API Limits/300 prompts per 5 hrs). 
*   **High Blood Pressure**: Too many open GitHub Issues and low Fuel. Causes the system to dynamically slow down Id/Ego creation and focuses system resources on Arms execution.
*   **Low Blood Pressure**: Few open tasks and high Fuel. Causes the system to speed up Id/Ego generation to fill the pipeline.

### 2. The Memory (GitHub)
Instead of relying on fragile LLM context windows, Clawmni OS uses GitHub as its brain. The user can continuously add, modify, or delete Goals and Issues natively from the app or GitHub UI. The OS will seamlessly integrate them into its flow.

### 3. The Heart (`server/heart.js`)
The core timing mechanism. A true system pulse.
*   **Adjustable Rate**: The user configures the Base Pulse Rate.
*   **Dynamic Fluctuation**: The Heart speeds up or slows down automatically based on the momentary Blood Pressure calculation.

### 4. The Organs
The specialized agents that process the Heart's pulses:

*   **Id (Divergent Thinking)**: Focused strictly on high-level brainstorming. Based on permanent Goals, the Id generates 10-30 simple, one-liner technical approaches. It maintains a steady flow of ideas and performs periodic cleanup/pruning.
*   **Ego (Executive Function)**: The filter. It selects only the most coherent ideas from the Id, categorizes them, and tags them by difficulty, importance, and relevance. It paces GitHub Issue creation to avoid over-stressing the Arms.
*   **Arms & Fingers (Execution)**: Reads the oldest/most important existing GitHub Issues first. Breaks them down by requirements, then spins up multiple "Fingers" to execute tasks simultaneously. 
*   **Nose (Code Auditing)**: Sniffs out old/placeholder code, logical errors, unsecured API keys, and other security risks. Reports findings back to the Ego for triage.

---

## 🛠️ Getting Started

### Prerequisites
* Node.js v18+
* A Firebase Project with Realtime Database enabled
* A Firebase Admin SDK Service Account JSON file
* A GitHub Fine-Grained Personal Access Token (PAT) with Read & Write access to Issues, Pull Requests, and Contents
* A Minimax API Key

### Installation

1. Clone this repository.
2. Install root dependencies:
   ```bash
   npm install
   ```
3. Install frontend dependencies:
   ```bash
   cd client
   npm install
   cd ..
   ```

### Running the OS

The easiest way to launch Clawmni OS V2 is to use the provided one-click startup scripts. These will automatically install dependencies, boot the backend daemon, and launch the React Dashboard in your browser.

*   **Windows**: Double-click `start.bat`
*   **Mac/Linux**: Run `./start.sh` in your terminal.

Alternatively, you can run them manually:
1. `cd server && npm install && npm run dev`
2. `cd client && npm install && npm run dev`

### Initialization

1. Once the browser opens to `http://localhost:5173`, follow the **Onboarding UI**.
2. Hover over the links provided to see tooltips on exactly where to generate your API keys, GitHub PAT, and Firebase service accounts.
3. Once initialized, use the **Dashboard** to set your **Target Repository** (e.g., `TheSandemon/clawmni`) and configure your API Fuel Limits.
4. Inject an **Abstract Goal** and watch the Organs come to life!

---

## 🧪 Neurochemistry System

Clawmni OS includes a baseline simulated neurochemistry system:
*   **Dopamine**: Increases upon successful system actions (e.g., successful API calls, opening a successful Pull Request).
*   **Cortisol**: Increases upon failures or errors (e.g., API timeouts, Octokit 403 errors, invalid Minimax JSON parsing). 

High cortisol triggers the system to force the Ego to prioritize debugging over executing new generative tasks.
