import { LiveClock } from '../booking/LiveClock'
import { WorkflowGraphic } from './WorkflowGraphic'
import './landing.css'

export function Hero() {
  return (
    <>
      <section className="unblock-hero" aria-labelledby="hero-title" id="book">
        <div className="hero-kicker">
          <span>AUTOMATION CLINIC</span>
          <span>LESS REPETITION. MORE POSSIBILITY.</span>
        </div>
        <div className="hero-stage">
          <div className="hero-copy">
            <h1 id="hero-title">
              UNBLOCK
              <br />
              <span>YOUR TIME.</span>
            </h1>
            <div className="hero-introduction">
              <span className="intro-arrow" aria-hidden="true">
                ↳
              </span>
              <div>
                <p>
                  Bring one repetitive task.
                  <br />
                  Explore a simpler way to work.
                </p>
                <p className="hero-detail">
                  A personal consultation to explore how automation could help
                  with the work that keeps coming back.
                </p>
                <a className="landing-button hero-cta" href="#booking-panel">
                  Book a session <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </div>
          <WorkflowGraphic />
        </div>
        <div className="hero-time-row">
          <LiveClock />
          <p className="time-note">
            MAKE SPACE
            <br />
            FOR YOUR
            <br />
            <span>NEXT IDEA. ↗</span>
          </p>
          <a className="explore-link" href="#how-it-works">
            A little less busywork <span aria-hidden="true">↓</span>
          </a>
        </div>
      </section>
      <section
        className="how-it-works"
        id="how-it-works"
        aria-labelledby="how-title"
        tabIndex={-1}
      >
        <div className="how-heading">
          <p>FROM REPETITION TO POSSIBILITY</p>
          <h2 id="how-title">How it works.</h2>
        </div>
        <ol>
          <li>
            <span>01 /</span>
            <h3>Choose a time</h3>
            <p>Find an available session that works for you.</p>
          </li>
          <li>
            <span>02 /</span>
            <h3>Describe your task</h3>
            <p>Tell us about one repetitive part of your work.</p>
          </li>
          <li>
            <span>03 /</span>
            <h3>Meet and explore solutions</h3>
            <p>Explore possible approaches together in your consultation.</p>
          </li>
        </ol>
      </section>
    </>
  )
}
