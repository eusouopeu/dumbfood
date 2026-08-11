import { useEffect, useState } from 'react';
import { onConfirmRequest, responderConfirm, type ConfirmRequest } from '../lib/confirm';

export default function ConfirmHost() {
  const [req, setReq] = useState<ConfirmRequest | null>(null);

  useEffect(() => onConfirmRequest(setReq), []);

  if (!req) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-stone-900/50 p-4 sm:items-center" onClick={() => responderConfirm(false)}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl dark:bg-stone-800"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-stone-800 dark:text-stone-100">{req.mensagem}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => responderConfirm(false)} className="btn-outline">
            Cancelar
          </button>
          <button
            onClick={() => responderConfirm(true)}
            className={req.perigo ? 'btn bg-red-600 text-white hover:bg-red-700' : 'btn-primary'}
          >
            {req.textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
