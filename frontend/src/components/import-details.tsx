import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Badge, Card, Icon } from './ui';
import { useTheme } from '../theme';

export function ImportDetails({record}:{record:Record<string,any>}) {
 const [open,setOpen]=useState(false); const {colors:c}=useTheme();
 if (!record.source_fields) return null;
 return <Card style={{gap:12}}><Pressable accessibilityRole="button" onPress={()=>setOpen(!open)} style={{flexDirection:'row',alignItems:'center',gap:10}}><Icon name="file-table-outline"/><View style={{flex:1}}><Text style={{color:c.onSurface,fontSize:15,fontWeight:'800'}}>Imported details</Text><Text style={{color:c.muted,fontSize:11,marginTop:3}}>{record.source_sheet} · row {record.source_row}</Text></View><Icon name={open?'chevron-up':'chevron-down'}/></Pressable>{record.review_status && record.review_status!=='Ready'?<Badge label={record.review_status} tone="warning"/>:null}{record.access_until?<Text style={{color:c.onSurface,fontWeight:'700'}}>Access until {record.access_until}</Text>:null}{record.benefit_expiry?<Text style={{color:c.onSurface,fontWeight:'700'}}>Benefit / credit expiry: {record.benefit_expiry}</Text>:null}{record.credits?<Text style={{color:c.onSurfaceTertiary,lineHeight:20}}>{record.credits}</Text>:null}{open?Object.entries(record.source_fields).map(([k,v])=><View key={k} style={{gap:4,borderTopWidth:1,borderTopColor:c.divider,paddingTop:9}}><Text style={{color:c.muted,fontSize:10,fontWeight:'800',textTransform:'uppercase'}}>{k}</Text><Text selectable style={{color:c.onSurface,fontSize:13,lineHeight:20}}>{String(v)}</Text></View>):null}</Card>;
}
