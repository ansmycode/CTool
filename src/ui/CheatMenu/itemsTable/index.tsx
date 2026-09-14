import {useGameFeature} from "@/game/GameFeatureContext";
import InventoryTable from "../InventoryTable";
import "./index.css";

interface Props {handleGainItem:(id:number,count:number,gainType:string)=>void;}
export default function ItemTable({handleGainItem}:Props){
  const {data}=useGameFeature("items");
  return <InventoryTable rows={data} searchPlaceholder="搜索道具 ID 或名称" tableClassName="menu-table"
    onChangeCount={(id,count)=>handleGainItem(id,count,"item")} />;
}
