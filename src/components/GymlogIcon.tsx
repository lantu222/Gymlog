import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type GymlogIconName =
  | 'arms'
  | 'back'
  | 'benchPress'
  | 'bell'
  | 'brain'
  | 'cardio'
  | 'check'
  | 'chevronRight'
  | 'chest'
  | 'clock'
  | 'core'
  | 'deadlift'
  | 'dumbbell'
  | 'endurance'
  | 'eye'
  | 'file'
  | 'flame'
  | 'glutes'
  | 'legs'
  | 'lightning'
  | 'mobility'
  | 'moon'
  | 'plus'
  | 'progress'
  | 'profile'
  | 'recovery'
  | 'restDay'
  | 'shoulders'
  | 'squat'
  | 'strength'
  | 'tempo';

interface GymlogIconProps {
  name: GymlogIconName;
  size?: number;
  color?: string;
}

export function GymlogIcon({ name, size = 18, color = '#FFFFFF' }: GymlogIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {renderIcon(name, color)}
    </Svg>
  );
}

function renderIcon(name: GymlogIconName, color: string) {
  switch (name) {
    case 'chest':
      return (
        <>
          <Path d="M4.4 8.4c2.7-3.4 5.5-3.1 7.6-.7 2.1-2.4 4.9-2.7 7.6.7-.7 4.8-3.1 7.6-7.6 8.6-4.5-1-6.9-3.8-7.6-8.6Z" fill={color} />
          <Path d="M12 7.6v9.2" stroke="#06080B" strokeWidth={1.5} strokeLinecap="round" />
          <Path d="M6.9 11.6c1.8 1.2 3.4 1.2 5.1-.1 1.7 1.3 3.3 1.3 5.1.1" stroke="#06080B" strokeWidth={1.2} strokeLinecap="round" />
        </>
      );
    case 'back':
      return (
        <>
          <Path d="M12 4.2c3.6 0 6.2 2.6 7.1 6.9l-2.5 6.2c-.5 1.2-1.6 2-2.9 2H10.3c-1.3 0-2.4-.8-2.9-2L4.9 11.1C5.8 6.8 8.4 4.2 12 4.2Z" fill={color} />
          <Path d="M12 5.6v12.1M8.5 9.1c2 1.2 5 1.2 7 0" stroke="#06080B" strokeWidth={1.2} strokeLinecap="round" />
        </>
      );
    case 'shoulders':
      return (
        <>
          <Circle cx={7} cy={9} r={3.3} fill={color} />
          <Circle cx={17} cy={9} r={3.3} fill={color} />
          <Path d="M8.8 14.6c1.7-1.4 4.7-1.4 6.4 0l-1.1 3.6H9.9l-1.1-3.6Z" fill={color} />
        </>
      );
    case 'arms':
      return <Path d="M5.1 15.2c1-4.9 4.8-8.1 8.8-6.8 2.4.8 4.1 2.9 4.9 6.1l-3.1 2.1c-.8-2.5-2.1-3.7-3.7-3.8-1.9-.1-3.6 1.4-4.7 4.4l-2.2-2Z" fill={color} />;
    case 'core':
      return (
        <>
          <Path d="M8.2 4.8h7.6l1.5 3.8-1.6 10.6H8.3L6.7 8.6l1.5-3.8Z" fill={color} />
          <Path d="M12 6.2v11.5M9.2 9.3h5.6M9.4 12.5h5.2M9.8 15.6h4.4" stroke="#06080B" strokeWidth={1.1} strokeLinecap="round" />
        </>
      );
    case 'legs':
      return <Path d="M8.2 4.5h3.5l.5 6.9-1.3 7.9H7.8l.7-7.8-.3-7Zm4.1 0h3.5l-.3 7 .7 7.8h-3.1l-1.3-7.9.5-6.9Z" fill={color} />;
    case 'glutes':
      return (
        <>
          <Path d="M5.2 11.8c0-3.3 2.3-5.6 5.6-5.8.6 2 .5 4.1-.4 6.3-.9 2.1-2.4 3.8-4.5 5.1-.5-1.6-.7-3.4-.7-5.6Z" fill={color} />
          <Path d="M18.8 11.8c0-3.3-2.3-5.6-5.6-5.8-.6 2-.5 4.1.4 6.3.9 2.1 2.4 3.8 4.5 5.1.5-1.6.7-3.4.7-5.6Z" fill={color} />
        </>
      );
    case 'benchPress':
      return (
        <>
          <Rect x={3} y={6.2} width={18} height={2.2} rx={1.1} fill={color} />
          <Rect x={4.4} y={4.8} width={2.2} height={5} rx={1.1} fill={color} />
          <Rect x={17.4} y={4.8} width={2.2} height={5} rx={1.1} fill={color} />
          <Path d="M6 16.3h11.2l2.2 2.9H5.1L6 16.3Zm3.2-5.7c2.3.2 4.4 1 6.4 2.5l-1.2 2.2H8.1l1.1-4.7Z" fill={color} />
        </>
      );
    case 'squat':
      return (
        <>
          <Circle cx={12} cy={5.2} r={2.1} fill={color} />
          <Path d="M5.2 9.2h13.6v2.1H5.2V9.2Zm4.2 2.7h5.2l2.5 4.1-2.2 1.2-1.8-2.5h-2.2l-1.8 2.5L6.9 16l2.5-4.1Z" fill={color} />
        </>
      );
    case 'deadlift':
      return (
        <>
          <Rect x={3.4} y={14.8} width={17.2} height={2.1} rx={1} fill={color} />
          <Circle cx={5.2} cy={15.9} r={2.2} fill={color} />
          <Circle cx={18.8} cy={15.9} r={2.2} fill={color} />
          <Path d="M10.3 6.2h3.4l2.1 7.5h-2.3l-1.5-4.1-1.5 4.1H8.2l2.1-7.5Z" fill={color} />
        </>
      );
    case 'dumbbell':
      return (
        <>
          <Path d="M8.3 12h7.4" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
          <Rect x={3.4} y={8.2} width={2.7} height={7.6} rx={1.2} stroke={color} strokeWidth={2} />
          <Rect x={6.5} y={6.8} width={2.8} height={10.4} rx={1.2} stroke={color} strokeWidth={2} />
          <Rect x={14.7} y={6.8} width={2.8} height={10.4} rx={1.2} stroke={color} strokeWidth={2} />
          <Rect x={17.9} y={8.2} width={2.7} height={7.6} rx={1.2} stroke={color} strokeWidth={2} />
        </>
      );
    case 'strength':
      return (
        <>
          <Rect x={2.8} y={10.4} width={18.4} height={3.2} rx={1.6} fill={color} />
          <Rect x={4.1} y={7.5} width={2.8} height={9} rx={1.4} fill={color} />
          <Rect x={17.1} y={7.5} width={2.8} height={9} rx={1.4} fill={color} />
          <Rect x={7.5} y={8.8} width={2.1} height={6.4} rx={1} fill={color} />
          <Rect x={14.4} y={8.8} width={2.1} height={6.4} rx={1} fill={color} />
        </>
      );
    case 'endurance':
    case 'cardio':
      return <Path d="M13.8 4.2a2.1 2.1 0 1 1-4.2 0 2.1 2.1 0 0 1 4.2 0Zm-2.2 4.1 2.7 2.4 3.1.6-.5 2.2-3.7-.7-1.2-1-1.1 2.6 2.7 2.3-1.5 1.8-3.3-2.7-.8 2.7H5.5l1.4-5 1.4-3.3-2.3.9-1.4 2-1.8-1.3 1.8-2.7 4.2-1.8 2.8 1Z" fill={color} />;
    case 'tempo':
      return (
        <>
          <Circle cx={12} cy={12} r={8.2} fill={color} />
          <Path d="M12 7.2v5l3.2 2" stroke="#06080B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'clock':
      return (
        <>
          <Circle cx={12} cy={12} r={8.3} stroke={color} strokeWidth={1.9} />
          <Path d="M12 7.4v5.1l3.3 2" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'chevronRight':
      return (
        <Path
          d="M9 5.2 15.8 12 9 18.8"
          stroke={color}
          strokeWidth={2.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'plus':
      return (
        <Path
          d="M12 5.2v13.6M5.2 12h13.6"
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      );
    case 'brain':
      return (
        <>
          <Path
            d="M8.4 17.5c-2.1 0-3.6-1.4-3.6-3.3 0-1 .4-1.8 1.1-2.4-.4-1.8.7-3.5 2.5-3.8.5-1.5 1.8-2.5 3.6-2.5 1.8 0 3.1 1 3.6 2.5 1.8.3 2.9 2 2.5 3.8.7.6 1.1 1.4 1.1 2.4 0 1.9-1.5 3.3-3.6 3.3H8.4Z"
            stroke={color}
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M12 5.7v11.6M8.2 10.5c1 .2 1.8.8 2.2 1.7M15.8 10.5c-1 .2-1.8.8-2.2 1.7M8.7 14.4h6.6"
            stroke={color}
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'mobility':
      return <Path d="M16 5.4a2.1 2.1 0 1 1-4.2 0 2.1 2.1 0 0 1 4.2 0Zm-4.9 4.2 3.3 1.5 3.5 4.8-2 1.3-2.7-3.7-2.2-.9-2.4 2.6-2.5 3.6-2.1-1.3 2.8-4.2 4.3-3.7Z" fill={color} />;
    case 'restDay':
      return (
        <>
          <Rect x={3.5} y={8.7} width={17} height={7.1} rx={1.8} fill={color} />
          <Rect x={4.5} y={6.3} width={5.2} height={3.2} rx={1.2} fill={color} />
          <Rect x={4} y={15.2} width={2} height={3.2} rx={1} fill={color} />
          <Rect x={18} y={15.2} width={2} height={3.2} rx={1} fill={color} />
        </>
      );
    case 'recovery':
      return <Path d="M12 4.1c3.7 0 6.8 3 6.8 6.8 0 3.7-3 6.8-6.8 6.8H8.9l1.9 1.9-1.5 1.5-4.6-4.6 4.6-4.6 1.5 1.5-2.1 2.1H12a4.6 4.6 0 1 0-4.6-4.6H5.2c0-3.8 3.1-6.8 6.8-6.8Z" fill={color} />;
    case 'moon':
      return <Path d="M17.8 15.9c-4.6 0-8.3-3.7-8.3-8.3 0-1.3.3-2.5.8-3.6-3.1.8-5.4 3.6-5.4 7 0 4 3.2 7.2 7.2 7.2 2.5 0 4.8-1.3 6.1-3.2-.2.6-.3.9-.4.9Z" fill={color} />;
    case 'flame':
      return (
        <Path
          d="M12.4 21.2c-4.2 0-7.3-2.8-7.3-6.8 0-2.8 1.5-4.9 3.7-6.7.4 1.7 1.2 2.7 2.2 3.2-.6-3.3.7-6.3 4.3-8.3.4 3 1.6 4.7 3 6.3 1.1 1.3 2 2.8 2 5.1 0 4.2-3.3 7.2-7.9 7.2Zm.1-2.5c1.7 0 3-1.2 3-2.8 0-1-.4-1.8-1.1-2.6-.7-.8-1.2-1.5-1.5-2.8-1.5 1.1-2 2.5-1.6 4.1-.9-.3-1.6-1-2.1-2-.8.9-1.2 1.8-1.2 2.9 0 1.9 1.8 3.2 4.5 3.2Z"
          fill={color}
        />
      );
    case 'lightning':
      return <Path d="M13.2 2.8 5.4 13.2h5.3l-1.1 8 8-11h-5.2l.8-7.4Z" fill={color} />;
    case 'progress':
      return (
        <>
          <Path d="M4.4 18.8h15.2M4.7 15.2l4.6-4.5 3.2 2.7 6.2-6.5" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M15.8 6.9h2.9v2.9" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case 'check':
      return <Path d="M9.6 16.4 4.9 11.7l-2 2 6.7 6.6L21.4 8.5l-2-2L9.6 16.4Z" fill={color} />;
    case 'eye':
      return (
        <>
          <Path
            d="M2.8 12c1.9-3.8 5.1-5.8 9.2-5.8s7.3 2 9.2 5.8c-1.9 3.8-5.1 5.8-9.2 5.8s-7.3-2-9.2-5.8Z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={2} />
        </>
      );
    case 'file':
      return (
        <>
          <Path
            d="M7.2 3.8h6.8l3.8 3.8v12.6H7.2V3.8Z"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M14 3.9v4h3.8M9.8 12h4.4M9.8 15.4h4.4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        </>
      );
    case 'bell':
      return (
        <>
          <Path
            d="M6.8 10.7c0-3.2 2.1-5.4 5.2-5.4s5.2 2.2 5.2 5.4v3.7l1.4 2.2H5.4l1.4-2.2v-3.7Z"
            stroke={color}
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M10 19c.5.7 1.2 1.1 2 1.1s1.5-.4 2-1.1" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
        </>
      );
    case 'profile':
      return (
        <>
          <Circle cx={12} cy={8.2} r={3.1} stroke={color} strokeWidth={1.9} />
          <Path
            d="M5.8 19.2c.8-3.3 2.9-5 6.2-5s5.4 1.7 6.2 5"
            stroke={color}
            strokeWidth={1.9}
            strokeLinecap="round"
          />
        </>
      );
    default:
      return <Circle cx={12} cy={12} r={8} fill={color} />;
  }
}
