import { useEffect, useRef, useId } from 'react';
export default function ChessResult({
  outcome,
  message,
  onClose,
  onReview,
}: {
  outcome: 'win' | 'lose' | 'draw' | 'ended';
  message: string;
  onClose: () => void;
  onReview: () => void;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="chess-result"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby={titleId}
    >
      <span aria-hidden="true" className="chess-result-symbol">
        {outcome === 'win' ? '♔' : outcome === 'draw' ? '½' : '♚'}
      </span>
      <p>CHESS CLUB · GAME COMPLETE</p>
      <h2 id={titleId}>
        {outcome === 'win'
          ? 'You won!'
          : outcome === 'lose'
            ? 'You lost'
            : outcome === 'draw'
              ? 'A draw'
              : 'Game ended'}
      </h2>
      <p>{message}</p>
      <div>
        <button autoFocus onClick={onReview}>
          Review the moves
        </button>
        <button onClick={onClose}>Close result</button>
      </div>
    </dialog>
  );
}
