import React from 'react';
import { useQcSheet } from './useQcSheet.js';
import {
  QcModal, CarriedFinding, BagHistoryBlock, SimpleBags, KgHistory, QcVerdict, QcNotes, QcPhotos,
  DecisionPair, ReturnPicker, QcActions, sheetSubtitle
} from './QcSheetFrame.jsx';

export default function QcIroning(props) {
  const qc = useQcSheet(props);
  return (
    <QcModal qc={qc} title={`QC — ${qc.item?.service_name || ''}`} subtitle={sheetSubtitle(qc)}>
      <CarriedFinding qc={qc} />
      <BagHistoryBlock qc={qc} />
      <SimpleBags qc={qc} />
      <KgHistory qc={qc} />
      <QcVerdict qc={qc} temuanDecision="kembali" />
      <QcNotes qc={qc} />
      <QcPhotos qc={qc} />
      {qc.qcStatus === 'temuan' && (
        <>
          <DecisionPair qc={qc} holdLabel="Hold / Kembalikan" holdDecision="kembali" />
          <ReturnPicker qc={qc} />
        </>
      )}
      <QcActions qc={qc} />
    </QcModal>
  );
}
