import QcFrontliner from './QcFrontliner.jsx';
import QcWashing from './QcWashing.jsx';
import QcIroning from './QcIroning.jsx';
import QcPacking from './QcPacking.jsx';
import QcDelivery from './QcDelivery.jsx';

const SHEET = {
  frontliner: QcFrontliner,
  washing: QcWashing,
  ironing: QcIroning,
  packing: QcPacking,
  delivery: QcDelivery,
  handover: QcDelivery
};

export default function ItemQCSheet(props) {
  const Sheet = SHEET[props.stage] || QcFrontliner;
  return <Sheet {...props} />;
}
