export function WorkflowGraphic() {
  return (
    <figure className="workflow-graphic">
      <div className="workflow-art" aria-hidden="true">
        <div className="workflow-grid" />
        <span className="workflow-cross cross-top">+</span>
        <span className="workflow-cross cross-bottom">+</span>
        <div className="work-block block-one">
          <span>REPEAT</span>
        </div>
        <div className="work-block block-two">
          <span>REPEAT</span>
        </div>
        <div className="work-block block-three">
          <span>RETHINK ↗</span>
        </div>
        <div className="work-block block-four">
          <span>ROOM TO THINK</span>
        </div>
        <span className="workflow-path">↗</span>
      </div>
      <figcaption>
        <span>THE SAME TASK. A NEW DIRECTION.</span>
        <span aria-hidden="true">[ UNBLOCKED ]</span>
      </figcaption>
    </figure>
  )
}
