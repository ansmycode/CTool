import {useGameFeature} from "@/game/GameFeatureContext";
import InventoryTable from "../InventoryTable";

interface Props {handleGainItem:(id:number,count:number,gainType:string)=>void;}
export default function ArmorTable({handleGainItem}:Props){
  const {data}=useGameFeature("armors");
  return <InventoryTable rows={data} searchPlaceholder="搜索防具 ID 或名称"
    onChangeCount={(id,count)=>handleGainItem(id,count,"armor")} />;
}
