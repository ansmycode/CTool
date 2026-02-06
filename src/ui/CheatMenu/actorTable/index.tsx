import React, { useState, useEffect } from "react";
import { Table, InputNumber, Checkbox, Input, Select, Card, Form } from "antd";

interface Props {
  actorData: any;
  classData: any;
  setActorInTeam: (ids: Array<number>) => Promise<void>;
  setActorData: (actor: any) => Promise<void>;
}
interface Item {
  id: number;
  name: string;
  playerHasCount: number;
}

// const { Option } = Select;

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
  const [listData, setlistData] = useState(actorData);
  const [form] = Form.useForm();

  useEffect(() => {
    setlistData(actorData);
  }, [actorData]);

  const inTeamChange = (id: number, value: boolean) => {
    const _listData = listData.map((item: any) =>
      item.id === id ? { ...item, inTeam: value } : item
    );
    setlistData(_listData);
    setActorInTeam(
      _listData.filter((item: any) => item.inTeam).map((actor: any) => actor.id)
    );
  };

  const onSubmit = (values: any) => {
    setActorData(values);
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
            console.log("修改后的数据：", allValues);
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px 24px",
            }}
          >
            {actorList.map((item: any) => {
              return (
                <Form.Item key={item.key} name={item.key} label={item.value}>
                  {item.key === "name" ? (
                    <Input
                      onBlur={(e) => {
                        const initialValue = form.getFieldValue(item.key);
                        if (e.target.value !== initialValue) {
                          form.submit();
                        }
                      }}
                    />
                  ) : item.key === "classId" ? (
                    <Select
                      style={{ width: "100%" }}
                      onChange={(value) => {
                        const initialValue = form.getFieldValue(item.key);
                        if (value !== initialValue) {
                          form.submit();
                        }
                      }}
                      options={classData}
                      fieldNames={{ label: "name", value: "id" }}
                    />
                  ) : (
                    <InputNumber
                      min={item.key === "level" ? 1 : 0}
                      style={{ width: "100%" }}
                      onBlur={(e) => {
                        const initialValue = form.getFieldValue(item.key);
                        if (Number(e.target.value) !== initialValue) {
                          form.submit();
                        }
                      }}
                    />
                  )}
                </Form.Item>
              );
            })}
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
      ellipsis: true,
      width: 50,
    },
    {
      title: "名称",
      dataIndex: "name",
      ellipsis: true,
    },
  ];
  return (
    <div>
      <Table
        columns={columns}
        dataSource={listData}
        rowKey="id"
        pagination={false}
        scroll={{ y: "31rem" }} // 设置高度，启用虚拟滚动
        size="small"
        expandable={{
          expandedRowRender,
          rowExpandable: () => true,
        }}
      />
    </div>
  );
};

export default ActorTable;
