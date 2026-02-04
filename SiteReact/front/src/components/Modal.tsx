import type { ReactNode } from "react";

type ModalProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
};

export default function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <strong>{title}</strong>
          <button className="btn" onClick={onClose} type="button">
            Fermer
          </button>
        </div>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
}
