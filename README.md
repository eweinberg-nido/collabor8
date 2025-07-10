# Collabor8

Collabor8 is a web application designed to facilitate peer feedback and collaboration within student project groups. It provides a centralized platform for teachers to manage sections, groups, and feedback cycles, and for students to provide and receive constructive feedback from their peers.

## Features

### For Teachers

*   **Section Management:** Create, edit, and archive course sections.
*   **Student Management:** Import student lists and easily assign them to groups.
*   **Group Management:** Create and manage project groups within each section.
*   **Feedback Cycles ("Check-ins"):** Initiate feedback periods ("check-ins") to collect peer evaluations.
*   **Feedback Visibility:** Control when students can see the feedback they've received.
*   **Comprehensive Feedback Viewer:** View all submitted feedback, filterable by student and check-in.

### For Students

*   **My Group:** View your assigned group and the members in it.
*   **Submit Feedback:** Provide structured feedback to your peers, including areas of strength, areas for growth, and a numeric grade.
*   **Self-Evaluation:** Submit a self-evaluation as part of each feedback cycle.
*   **My Feedback:** View the feedback you've received from your peers for each check-in.

## Tech Stack

*   **Frontend:**
    *   [React](https://reactjs.org/)
    *   [React Router](https://reactrouter.com/) for navigation
    *   [Bootstrap](https://getbootstrap.com/) for styling
*   **Backend:**
    *   [Firebase](https://firebase.google.com/)
        *   **Firestore:** NoSQL database for storing all application data.
        *   **Firebase Authentication:** For user authentication with Google Sign-In.

## Getting Started

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

### Prerequisites

*   Node.js and npm
*   A Firebase project with Firestore and Authentication enabled.

### Installation

1.  Clone the repository:
    ```sh
    git clone https://github.com/your-username/collabor8.git
    ```
2.  Navigate to the project directory:
    ```sh
    cd collabor8
    ```
3.  Install the dependencies:
    ```sh
    npm install
    ```
4.  Create a `firebase-config.js` file in the `src/util` directory with your Firebase project's configuration:
    ```javascript
    // src/util/firebase-config.js
    import { initializeApp } from "firebase/app";
    import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
    import { getFirestore } from "firebase/firestore";

    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_AUTH_DOMAIN",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_STORAGE_BUCKET",
      messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
      appId: "YOUR_APP_ID"
    };

    const app = initializeApp(firebaseConfig);
    export const auth = getAuth(app);
    export const db = getFirestore(app);

    const provider = new GoogleAuthProvider();
    export const signInWithGoogle = () => {
      signInWithPopup(auth, provider);
    };
    ```
5.  Start the development server:
    ```sh
    npm start
    ```

The application will be available at `http://localhost:3000`.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.

### `npm test`

Launches the test runner in the interactive watch mode.

### `npm run build`

Builds the app for production to the `build` folder.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**