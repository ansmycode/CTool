import React, { useState, useEffect } from "react";
import { Table, InputNumber, Checkbox, Input, Select, Card, Form } from "antd";

interface Props {
  actorData: any[];
  classData: any[];
  setActorInTeam: (ids: Array<number>) => Promise<void>;
  setActorData: (actor: any) => Promise<void>;
}

interface Item {
  id: number;
  name: string;
  playerHasCount: number;
}

const actorList = [
  { key: "name", value: "姓名" },
  { key: "classId", value: "职业" },
  { key: "level", value: "等级" },
  { key: "exp", value: "经验值" },
  { key: "hp", value: "HP" },
  { key: "mp", value: "MP" },
  { key: "tp", value: "TP" },
  { key: "atk", value: "攻击力" },
  { key: "def", value: "防御力" },
  { key: "mat", value: "魔法攻击" },
  { key: "mdf", value: "魔法防御" },
  { key: "agi", value: "敏捷" },
  { key: "luk", value: "幸运" },
];

const ActorTable: React.FC<Props> = ({
  actorData,
  setActorInTeam,
  classData,
  setActorData,
}) => {
  const [listData, setListData] = useState(actorData);
  const [expandedKeys, setExpandedKeys] = useState<number[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    setListData(actorData);
  }, [actorData]);

  const inTeamChange = (id: number, value: boolean) => {
    const newList = listData.map((item: any) =>
      item.id === id ? { ...item, inTeam: value } : item
    );
    setListData(newList);

    setActorInTeam(
      newList.filter((item: any) => item.inTeam).map((actor: any) => actor.id)
    );
  };

  const onSubmit = (values: any) => {
    setActorData(values);
  };

  const renderFormItem = (item: any) => {
    if (item.key === "name") {
      return <Input />;
    }

    if (item.key === "classId") {
      return (
        <Select
          style={{ width: "100%" }}
          options={classData}
          fieldNames={{ label: "name", value: "id" }}
        />
      );
    }

    return (
      <InputNumber
        min={item.key === "level" ? 1 : 0}
        style={{ width: "100%" }}
      />
    );
  };

  const expandedRowRender = (actor: any) => {
    return (
      <Card title={`角色编辑：${actor?.name || ""}`} bordered={false}>
        <Form
          form={form}
          layout="vertical"
          initialValues={actor}
          onFinish={onSubmit}
          onValuesChange={(_, allValues) => {
            setActorData({ ...actor, ...allValues });
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px 24px",
            }}
          >
            {actorList.map((item) => (
              <Form.Item key={item.key} name={item.key} label={item.value}>
                {renderFormItem(item)}
              </Form.Item>
            ))}
          </div>
        </Form>
      </Card>
    );
  };

  const columns = [
    {
      title: "在队伍中",
      dataIndex: "inTeam",
      width: 80,
      render: (isIn: boolean, record: Item) => (
        <Checkbox
          checked={isIn}
          onChange={(e: any) => {
            inTeamChange(record.id, e.target.checked);
          }}
        />
      ),
    },
    {
      title: "ID",
      dataIndex: "id",
      width: 60,
    },
    {
      title: "名称",
      dataIndex: "name",
    },
  ];

  return (
    <div className="table-container">
      <Table
        columns={columns}
        dataSource={listData}
        rowKey="id"
        pagination={false}
        scroll={{ y: "70vh" }}
        size="small"
        expandable={{
          expandedRowKeys: expandedKeys,
          onExpand: (expanded, record: any) => {
            setExpandedKeys(expanded ? [record.id] : []);
            form.setFieldsValue(record);
          },
          expandedRowRender,
        }}
      />
    </div>
  );
};

export default ActorTable;
