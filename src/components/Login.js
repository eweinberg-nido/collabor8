import React from 'react';
import { signInWithGoogle } from '../util/firebase-config'; // Adjust the path as necessary

const Login = () => {
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      console.log('User signed in successfully');
    } catch (error) {
      console.error('Error signing in: ', error);
    }
  };

  return (
    <button onClick={handleLogin}>Sign in with Google</button>
  );
};

export default Login;
