import { render, screen } from '@testing-library/react';
import App from './App';
import { AuthContext } from './context/Authcontext';

test('renders the public home page', () => {
  render(
    <AuthContext.Provider value={{ currentUser: null, loading: false, logout: jest.fn() }}>
      <App />
    </AuthContext.Provider>
  );

  expect(screen.getByText(/this platform allows you to provide and receive feedback/i)).toBeInTheDocument();
});
