import React from 'react';
import { MessageCircle } from 'lucide-react';
import { buildWaLink, downloadQcPhotos, qcItemLabel } from '../../../utils/produksiShared.js';
import { useQcSheet } from './useQcSheet.js';
import {
  QcModal, CarriedFinding, SimpleBags, IroningAsk, QcVerdict, QcNotes, QcPhotos,
  DecisionPair, QcActions, sheetSubtitle
} from './QcSheetFrame.jsx';

export default function QcFrontliner(props) {
  const qc = useQcSheet(props);
  return (
    <QcModal qc={qc} title={`QC — ${qc.item?.service_name || ''}`} subtitle={sheetSubtitle(qc)}>
      <CarriedFinding qc={qc} />
      <SimpleBags qc={qc} />
      <IroningAsk qc={qc} />
      <QcVerdict qc={qc} temuanDecision="lanjut" />
      <QcNotes qc={qc} />
      <QcPhotos qc={qc} />
      {qc.qcStatus === 'temuan' && (
        <>
          {qc.txn?.customer_phone && (
            <button
              type="button"
              onClick={() => {
                if (!qc.notes.trim()) {
                  qc.setError('Isi catatan temuan dulu.');
                  return;
                }
                if (!qc.photos.length) {
                  qc.setError('Ambil foto temuan dulu. Foto terunduh ke galeri saat WhatsApp dibuka.');
                  return;
                }
                downloadQcPhotos(qc.photos);
                qc.setWaContacted(true);
                window.open(buildWaLink(qc.txn.customer_phone, qc.notes, qcItemLabel(qc.item)), '_blank', 'noopener,noreferrer');
              }}
              className="w-full py-3 rounded-[14px] bg-emerald-500 text-white text-[12.5px] font-extrabold flex items-center justify-center gap-2 active:scale-[.98] transition"
            >
              <MessageCircle className="w-4 h-4" />
              Hubungi Customer via WA
            </button>
          )}
          <DecisionPair qc={qc} holdLabel="Hold (Tunggu Customer)" holdDecision="hold" />
        </>
      )}
      <QcActions qc={qc} />
    </QcModal>
  );
}
