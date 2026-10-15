import React from 'react';
import { useQcSheet } from './useQcSheet.js';
import {
  QcModal, CarriedFinding, QcVerdict, QcNotes, QcPhotos,
  DecisionPair, ReturnPicker, QcActions, sheetSubtitle
} from './QcSheetFrame.jsx';

export default function QcDelivery(props) {
  const qc = useQcSheet(props);
  const title = qc.isHandover ? `Serah Terima — ${qc.item?.service_name || ''}` : `QC — ${qc.item?.service_name || ''}`;
  return (
    <QcModal qc={qc} title={title} subtitle={sheetSubtitle(qc)}>
      <CarriedFinding qc={qc} />
      <QcVerdict qc={qc} temuanDecision={qc.isHandover ? 'lanjut' : 'kembali'} />
      <QcNotes qc={qc} />
      <QcPhotos qc={qc} />
      {qc.qcStatus === 'temuan' && !qc.isHandover && (
        <>
          <DecisionPair qc={qc} holdLabel="Kembalikan ke Packing" holdDecision="kembali" />
          <ReturnPicker qc={qc} />
        </>
      )}
      {qc.qcStatus === 'temuan' && qc.isHandover && (
        <div className="bg-amber-50 border border-amber-200 rounded-[14px] p-3 text-[11px] text-amber-800 font-semibold">
          Temuan tetap menandai Selesai. Catatan & foto tersimpan di riwayat Alsa.
        </div>
      )}
      <QcActions qc={qc} />
    </QcModal>
  );
}
