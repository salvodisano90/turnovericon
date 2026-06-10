// components/Icon.tsx
// Sistema icone SVG nativo (react-native-svg), ispirato a SF Symbols (iOS 26).
// Sostituisce @expo/vector-icons / Ionicons: nessuna dipendenza da font TTF.
// API compatibile: <Icon name="..." size={20} color="#000" />
// Rendering identico su Web, iOS e Android. Stroke uniforme, ottimizzato dark/light.

import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

export type IconName =
  | 'add' | 'close' | 'close-circle' | 'chevron-back' | 'chevron-forward'
  | 'arrow-undo' | 'arrow-redo' | 'backspace-outline' | 'trash-outline'
  | 'create-outline' | 'calendar' | 'calendar-outline' | 'document-text-outline'
  | 'grid-outline' | 'people' | 'people-outline' | 'person-add-outline'
  | 'business' | 'business-outline' | 'pulse' | 'pulse-outline'
  | 'stats-chart' | 'bar-chart-outline' | 'construct-outline'
  | 'sparkles' | 'sparkles-outline';

interface IconProps {
  name: IconName | string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

// Tutte le icone sono disegnate su un viewBox 24×24 con stroke uniforme e linee pulite.
// Le primitive ereditano stroke=color (o fill=color per le varianti piene).
function paths(name: string, c: string): React.ReactNode {
  const sw = 2;             // stroke uniforme
  const s = { stroke: c, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const fill = { fill: c };
  switch (name) {
    case 'add':
      return (<>
        <Line x1={12} y1={5} x2={12} y2={19} {...s} />
        <Line x1={5} y1={12} x2={19} y2={12} {...s} />
      </>);
    case 'close':
      return (<>
        <Line x1={6} y1={6} x2={18} y2={18} {...s} />
        <Line x1={18} y1={6} x2={6} y2={18} {...s} />
      </>);
    case 'close-circle':
      return (<>
        <Circle cx={12} cy={12} r={9} {...s} />
        <Line x1={9} y1={9} x2={15} y2={15} {...s} />
        <Line x1={15} y1={9} x2={9} y2={15} {...s} />
      </>);
    case 'chevron-back':
      return <Polyline points="15,5 8,12 15,19" {...s} />;
    case 'chevron-forward':
      return <Polyline points="9,5 16,12 9,19" {...s} />;
    case 'arrow-undo':
      return (<>
        <Polyline points="9,7 4,12 9,17" {...s} />
        <Path d="M4 12 H14 a6 6 0 0 1 6 6 V19" {...s} />
      </>);
    case 'arrow-redo':
      return (<>
        <Polyline points="15,7 20,12 15,17" {...s} />
        <Path d="M20 12 H10 a6 6 0 0 0 -6 6 V19" {...s} />
      </>);
    case 'backspace-outline':
      return (<>
        <Path d="M9 5 H20 a2 2 0 0 1 2 2 V17 a2 2 0 0 1 -2 2 H9 L2 12 Z" {...s} />
        <Line x1={13} y1={10} x2={18} y2={14} {...s} />
        <Line x1={18} y1={10} x2={13} y2={14} {...s} />
      </>);
    case 'trash-outline':
      return (<>
        <Line x1={4} y1={7} x2={20} y2={7} {...s} />
        <Path d="M9 7 V5 a2 2 0 0 1 2 -2 h2 a2 2 0 0 1 2 2 V7" {...s} />
        <Path d="M6 7 l1 13 a2 2 0 0 0 2 2 h6 a2 2 0 0 0 2 -2 l1 -13" {...s} />
        <Line x1={10} y1={11} x2={10} y2={18} {...s} />
        <Line x1={14} y1={11} x2={14} y2={18} {...s} />
      </>);
    case 'create-outline':
      return (<>
        <Path d="M12 20 H21" {...s} />
        <Path d="M16.5 3.5 a2.12 2.12 0 0 1 3 3 L8 18 l-4 1 1 -4 Z" {...s} />
      </>);
    case 'calendar':
    case 'calendar-outline':
      return (<>
        <Rect x={4} y={5} width={16} height={16} rx={2.5} {...s} />
        <Line x1={4} y1={9.5} x2={20} y2={9.5} {...s} />
        <Line x1={8} y1={3} x2={8} y2={6.5} {...s} />
        <Line x1={16} y1={3} x2={16} y2={6.5} {...s} />
      </>);
    case 'document-text-outline':
      return (<>
        <Path d="M7 3 H14 l5 5 V20 a1 1 0 0 1 -1 1 H7 a1 1 0 0 1 -1 -1 V4 a1 1 0 0 1 1 -1 Z" {...s} />
        <Path d="M14 3 V8 H19" {...s} />
        <Line x1={9} y1={13} x2={15} y2={13} {...s} />
        <Line x1={9} y1={16.5} x2={15} y2={16.5} {...s} />
      </>);
    case 'grid-outline':
      return (<>
        <Rect x={4} y={4} width={7} height={7} rx={1.6} {...s} />
        <Rect x={13} y={4} width={7} height={7} rx={1.6} {...s} />
        <Rect x={4} y={13} width={7} height={7} rx={1.6} {...s} />
        <Rect x={13} y={13} width={7} height={7} rx={1.6} {...s} />
      </>);
    case 'people':
    case 'people-outline':
      return (<>
        <Circle cx={9} cy={8} r={3.2} {...s} />
        <Path d="M3 20 a6 6 0 0 1 12 0" {...s} />
        <Path d="M16 5.2 a3 3 0 0 1 0 5.6" {...s} />
        <Path d="M17.5 14 a5.5 5.5 0 0 1 4 6" {...s} />
      </>);
    case 'person-add-outline':
      return (<>
        <Circle cx={10} cy={8} r={3.4} {...s} />
        <Path d="M4 20 a6 6 0 0 1 12 0" {...s} />
        <Line x1={19} y1={6} x2={19} y2={12} {...s} />
        <Line x1={16} y1={9} x2={22} y2={9} {...s} />
      </>);
    case 'business':
    case 'business-outline':
      return (<>
        <Path d="M5 21 V4 a1 1 0 0 1 1 -1 h7 a1 1 0 0 1 1 1 V21" {...s} />
        <Path d="M14 9 h4 a1 1 0 0 1 1 1 V21" {...s} />
        <Line x1={3} y1={21} x2={21} y2={21} {...s} />
        <Line x1={8} y1={7} x2={11} y2={7} {...s} />
        <Line x1={8} y1={11} x2={11} y2={11} {...s} />
        <Line x1={8} y1={15} x2={11} y2={15} {...s} />
      </>);
    case 'pulse':
    case 'pulse-outline':
      return <Polyline points="2,12 7,12 9.5,5 13,19 15.5,12 22,12" {...s} />;
    case 'stats-chart':
      return (<>
        <Line x1={6} y1={20} x2={6} y2={10} {...s} strokeWidth={2.5} />
        <Line x1={12} y1={20} x2={12} y2={4} {...s} strokeWidth={2.5} />
        <Line x1={18} y1={20} x2={18} y2={13} {...s} strokeWidth={2.5} />
      </>);
    case 'bar-chart-outline':
      return (<>
        <Line x1={4} y1={20} x2={20} y2={20} {...s} />
        <Rect x={6} y={11} width={3} height={7} rx={0.8} {...s} />
        <Rect x={11} y={7} width={3} height={11} rx={0.8} {...s} />
        <Rect x={16} y={13} width={3} height={5} rx={0.8} {...s} />
      </>);
    case 'construct-outline':
      return (<>
        <Path d="M14.5 6 a3.8 3.8 0 0 0 -5 5 L3.5 17 a1.5 1.5 0 0 0 0 2.1 l1.4 1.4 a1.5 1.5 0 0 0 2.1 0 L13 14.5 a3.8 3.8 0 0 0 5 -5 l-2.7 2.7 -2.5 -2.5 Z" {...s} />
        <Line x1={6} y1={18} x2={7.5} y2={16.5} {...s} />
      </>);
    case 'sparkles':
      // variante "piena"
      return (<>
        <Path d="M12 3 l1.7 4.8 L18.5 9.5 l-4.8 1.7 L12 16 l-1.7 -4.8 L5.5 9.5 l4.8 -1.7 Z" {...fill} />
        <Path d="M18.5 14 l.8 2 2 .8 -2 .8 -.8 2 -.8 -2 -2 -.8 2 -.8 Z" {...fill} />
      </>);
    case 'sparkles-outline':
      return (<>
        <Path d="M12 3 l1.7 4.8 L18.5 9.5 l-4.8 1.7 L12 16 l-1.7 -4.8 L5.5 9.5 l4.8 -1.7 Z" {...s} />
        <Path d="M18.5 14 l.8 2 2 .8 -2 .8 -.8 2 -.8 -2 -2 -.8 2 -.8 Z" {...s} />
      </>);
    case 'checkmark':
      return <Polyline points="5,13 10,18 19,6" {...s} />;
    case 'time': case 'time-outline':
      return (<><Circle cx={12} cy={12} r={8.5} {...s} /><Polyline points="12,7 12,12 16,14" {...s} /></>);
    case 'moon':
      return <Path d="M20 14.5 A8 8 0 1 1 9.5 4 a6.5 6.5 0 0 0 10.5 10.5 Z" {...s} />;
    case 'sunny':
      return (<><Circle cx={12} cy={12} r={4.2} {...s} /><Line x1={12} y1={2.5} x2={12} y2={5} {...s} /><Line x1={12} y1={19} x2={12} y2={21.5} {...s} /><Line x1={2.5} y1={12} x2={5} y2={12} {...s} /><Line x1={19} y1={12} x2={21.5} y2={12} {...s} /><Line x1={5.2} y1={5.2} x2={6.9} y2={6.9} {...s} /><Line x1={17.1} y1={17.1} x2={18.8} y2={18.8} {...s} /><Line x1={5.2} y1={18.8} x2={6.9} y2={17.1} {...s} /><Line x1={17.1} y1={6.9} x2={18.8} y2={5.2} {...s} /></>);
    case 'flag':
      return (<><Line x1={6} y1={21} x2={6} y2={4} {...s} /><Path d="M6 5 H17 l-2.5 3.5 L17 12 H6" {...s} /></>);
    case 'heart':
      return <Path d="M12 20 C5 15 3 11 3 8 a4.5 4.5 0 0 1 9 -1 a4.5 4.5 0 0 1 9 1 c0 3 -2 7 -9 12 Z" {...s} />;
    case 'alert-circle': case 'alert-circle-outline':
      return (<><Circle cx={12} cy={12} r={9} {...s} /><Line x1={12} y1={7} x2={12} y2={13} {...s} /><Line x1={12} y1={16.5} x2={12} y2={16.6} {...s} strokeWidth={2.5} /></>);
    case 'download-outline':
      return (<><Polyline points="7,11 12,16 17,11" {...s} /><Line x1={12} y1={4} x2={12} y2={16} {...s} /><Path d="M4 19 H20" {...s} /></>);
    case 'search-outline':
      return (<><Circle cx={11} cy={11} r={6.5} {...s} /><Line x1={16} y1={16} x2={20} y2={20} {...s} /></>);
    case 'home': case 'home-outline':
      return (<><Path d="M4 11 L12 4 L20 11" {...s} /><Path d="M6 10 V20 H18 V10" {...s} /></>);
    case 'list-outline':
      return (<><Line x1={8} y1={7} x2={20} y2={7} {...s} /><Line x1={8} y1={12} x2={20} y2={12} {...s} /><Line x1={8} y1={17} x2={20} y2={17} {...s} /><Circle cx={4} cy={7} r={1} {...fill} /><Circle cx={4} cy={12} r={1} {...fill} /><Circle cx={4} cy={17} r={1} {...fill} /></>);
    case 'call-outline':
      return <Path d="M6 4 h3 l1.5 4 -2 1.5 a10 10 0 0 0 5 5 l1.5 -2 4 1.5 v3 a1.5 1.5 0 0 1 -1.5 1.5 A15 15 0 0 1 4.5 6.5 1.5 1.5 0 0 1 6 4 Z" {...s} />;
    case 'mail-outline': case 'mail-unread-outline':
      return (<><Rect x={3.5} y={6} width={17} height={12} rx={2} {...s} /><Polyline points="4,8 12,13 20,8" {...s} /></>);
    case 'log-in-outline':
      return (<><Path d="M14 4 H18 a1.5 1.5 0 0 1 1.5 1.5 V18.5 A1.5 1.5 0 0 1 18 20 H14" {...s} /><Polyline points="9,8 13,12 9,16" {...s} /><Line x1={4} y1={12} x2={13} y2={12} {...s} /></>);
    case 'log-out-outline':
      return (<><Path d="M10 4 H6 a1.5 1.5 0 0 0 -1.5 1.5 V18.5 A1.5 1.5 0 0 0 6 20 H10" {...s} /><Polyline points="16,8 20,12 16,16" {...s} /><Line x1={9} y1={12} x2={20} y2={12} {...s} /></>);
    case 'person': case 'person-circle-outline': case 'person-outline':
      return (<><Circle cx={12} cy={9} r={3.5} {...s} /><Path d="M5.5 19 a6.5 6.5 0 0 1 13 0" {...s} /></>);
    case 'save-outline':
      return (<><Path d="M5 5 h11 l3 3 v11 H5 Z" {...s} /><Rect x={8} y={5} width={6} height={4} {...s} /><Rect x={8} y={13} width={8} height={5} {...s} /></>);
    case 'notifications-outline': case 'notifications':
      return (<><Path d="M7 17 V11 a5 5 0 0 1 10 0 V17 l1.5 2 H5.5 Z" {...s} /><Path d="M10.5 20 a1.5 1.5 0 0 0 3 0" {...s} /></>);
    case 'medkit': case 'medkit-outline': case 'medical': case 'medical-outline':
      return (<><Rect x={4} y={8} width={16} height={11} rx={2} {...s} /><Path d="M9 8 V6 a1.5 1.5 0 0 1 1.5 -1.5 h3 A1.5 1.5 0 0 1 15 6 V8" {...s} /><Line x1={12} y1={11.5} x2={12} y2={15.5} {...s} /><Line x1={10} y1={13.5} x2={14} y2={13.5} {...s} /></>);
    case 'eyedrop': case 'eyedrop-outline':
      return <Path d="M12 4 C12 4 6.5 10 6.5 14 a5.5 5.5 0 0 0 11 0 C17.5 10 12 4 12 4 Z" {...s} />;
    case 'bed': case 'bed-outline':
      return (<><Path d="M3 18 V9 h11 a5 5 0 0 1 5 5 v4" {...s} /><Line x1={3} y1={14} x2={19} y2={14} {...s} /><Circle cx={7} cy={11.5} r={1.5} {...s} /></>);
    case 'add-circle-outline': case 'add-circle':
      return (<><Circle cx={12} cy={12} r={9} {...s} /><Line x1={12} y1={8} x2={12} y2={16} {...s} /><Line x1={8} y1={12} x2={16} y2={12} {...s} /></>);
    case 'pencil': case 'create-outline':
      return (<><Path d="M5 19 l1 -4 L16 5 l3 3 L9 18 Z" {...s} /><Line x1={14} y1={7} x2={17} y2={10} {...s} /></>);
    case 'trash': case 'trash-outline':
      return (<><Polyline points="5,7 19,7" {...s} /><Path d="M7 7 l1 12 h8 l1 -12" {...s} /><Path d="M9.5 7 V5 h5 V7" {...s} /></>);
    case 'chevron-forward-outline':
      return <Polyline points="9,5 16,12 9,19" {...s} />;
    case 'stats-chart-outline':
      return (<><Line x1={6} y1={20} x2={6} y2={10} {...s} /><Line x1={12} y1={20} x2={12} y2={4} {...s} /><Line x1={18} y1={20} x2={18} y2={13} {...s} /></>);
    case 'flask-outline':
      return (<><Path d="M10 4 V9 L5 18 a1.5 1.5 0 0 0 1.4 2.2 h11.2 A1.5 1.5 0 0 0 19 18 L14 9 V4" {...s} /><Line x1={9} y1={4} x2={15} y2={4} {...s} /><Line x1={8} y1={14} x2={16} y2={14} {...s} /></>);
    default:
      // fallback neutro per nomi non mappati (cerchio nel colore richiesto, mai testo/nero)
      return <Circle cx={12} cy={12} r={9} {...s} />;
  }
}

export default function Icon({ name, size = 24, color = '#FFFFFF', style }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style as StyleProp<ViewStyle>}>
      {paths(name, color)}
    </Svg>
  );
}
