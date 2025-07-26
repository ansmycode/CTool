import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import ArmorTable from "./armorTable/index";
import Home from "./home/index";
import WeaponTable from "./weaponTable/index";
import SwitchesTable from "./switchesTable/index";
import VariablesTable from "./variablesTable/index";
import ItemsTable from "./itemsTable/index";

import type { TabsProps } from 'antd';

interface GameProps {
    isGameStarting: boolean
}

const CheatMenu: React.FC<GameProps> = ({ isGameStarting }) => {
    useEffect(() => {
        console.log(isGameStarting)
    }, [])

    const [activeKey, setActiveKey] = useState("1")
    const menuList: TabsProps['items'] = [
        {
            key: '1',
            label: '主页',
            children: <Home />,
        },
        {
            key: '2',
            label: '物品: 道具',
            children: <ItemsTable />,
        },
        {
            key: '3',
            label: '物品: 防具',
            children: <ArmorTable />,
        },
        {
            key: '4',
            label: '物品: 武器',
            children: <WeaponTable />,
        },
        {
            key: '5',
            label: '变量',
            children: <VariablesTable />,
        },
        {
            key: '6',
            label: '开关',
            children: <SwitchesTable />,
        },
    ];

    const TabsChange = (key: string) => {
        setActiveKey(key)
    }

    return (
        <div>
            <Tabs activeKey={activeKey} items={menuList} onChange={TabsChange} />
        </div>
    );
};

export default CheatMenu;
