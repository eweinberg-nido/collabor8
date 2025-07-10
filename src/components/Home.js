import React from 'react';

const Home = () => {
  return (
    <div className="container mt-4">
      <h1 className="text-primary">Welcome to Collabor8!</h1>
      <p className="lead">This platform allows you to provide and receive feedback from your peers. The idea is to have everything in one place and not have to do a series of Google Forms. Here’s what you can do:</p>
      <hr />
      <h2>View and Submit Feedback</h2>
      <ul>
        <li>
          <strong>Navigate to My Group:</strong> Click on the "My Group" link in the navigation bar to access your group’s page.
        </li>
        <li>
          <strong>Submit Feedback:</strong> During an active check-in period, you will see a form to provide feedback for each of your group members, including a self-evaluation.
        </li>
        <li>
          <strong>Feedback Fields:</strong>
          <ul>
            <li><strong>Area of Strength:</strong> Highlight the strengths and positive aspects of your peer's contributions.</li>
            <li><strong>Area of Growth:</strong> Identify areas where your peer can improve.</li>
            <li><strong>Grade:</strong> Provide a numerical grade for your peer’s performance. This should be Level 1 - 4 based on our collaboration rubric.</li>
          </ul>
        </li>
        <li>
          <strong>Submit:</strong> Once you’ve filled in all the feedback fields, click the "Submit Feedback" button.
        </li>
      </ul>
      <hr />
      <h2>View Received Feedback</h2>
      <ul>
        <li>
          <strong>Navigate to My Feedback:</strong> Click on the "My Feedback" link in the navigation bar to see feedback that has been provided for you by your group members.
        </li>
        <li>
          <strong>Check-in Titles:</strong> Feedback is organized by check-in periods. Click on a check-in title to view the compiled feedback.
        </li>
        <li>
          <strong>Feedback Summary:</strong>
          <ul>
            <li><strong>Areas of Strength:</strong> View a list of positive feedback from your peers.</li>
            <li><strong>Areas of Growth:</strong> View a list of constructive feedback from your peers.</li>
            <li><strong>Grades:</strong> See the numerical grades provided by your peers.</li>
          </ul>
        </li>
      </ul>
      <hr />
      <h2>General Tips</h2>
      <ul>
        <li><strong>Be Constructive:</strong> When providing feedback, be honest and constructive. Focus on providing helpful and actionable advice.</li>
        <li><strong>Be Respectful:</strong> Always be respectful and considerate when giving feedback. Remember that the goal is to help each other improve.</li>
        <li><strong>Reflect on Feedback:</strong> Use the feedback you receive to reflect on your own performance and identify areas for improvement.</li>
      </ul>
      <hr />
      <h2>Need Help?</h2>
      <p>If you have any questions or need assistance, feel free to reach out to your teacher or check the help resources available on this platform.</p>
    </div>
  );
};

export default Home;
