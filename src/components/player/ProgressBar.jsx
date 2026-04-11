import React from 'react';

const ProgressBar = () => {
  return (
    <div className="progress-bar">
      <span className="time-current">0:00</span>
      <input type="range" min="0" max="100" value="0" className="progress-slider" />
      <span className="time-total">0:00</span>
    </div>
  );
};

export default ProgressBar;
