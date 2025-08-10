import React from 'react';

const StudentList = ({ students, selectedStudent, setSelectedStudent, handleDeleteStudent }) => {
  return (
    <ul className="list-group">
      {students.map(student => (
        <li
          key={student}
          className={`list-group-item ${selectedStudent === student ? 'active' : ''}`}
          onClick={() => setSelectedStudent(selectedStudent === student ? null : student)}
          style={{ wordWrap: 'break-word', position: 'relative' }}
        >
          {student}
          {handleDeleteStudent && selectedStudent === student && (
            <button
              className="btn btn-danger btn-sm position-absolute top-50 end-0 translate-middle-y"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteStudent(student);
              }}
            >
              &times;
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};

export default StudentList;
