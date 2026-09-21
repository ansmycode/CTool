import {useGameFeature} from "@/game/GameFeatureContext";
import InventoryTable from "../../components/InventoryTable";

interface Props {handleGainItem:(id:number,count:number,gainType:string)=>void;}
export default function WeaponTable({handleGainItem}:Props){
  const {data}=useGameFeature("weapons");
  return <InventoryTable rows={data} searchPlaceholder="搜索武器 ID 或名称"
    onChangeCount={(id,count)=>handleGainItem(id,count,"weapon")} />;
}
