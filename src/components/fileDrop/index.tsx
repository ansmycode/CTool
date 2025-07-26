import React, { useEffect, useRef, useState } from 'react';
import { InboxOutlined } from '@ant-design/icons';
import { message } from 'antd';

interface FileDropProps {
  onDrop: (filePath: string) => void;
}

const FileDrop: React.FC<FileDropProps> = ({ onDrop }) => {
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const dropArea = dropRef.current;
    if (!dropArea) return;

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);

      const files = e.dataTransfer?.files;
      console.log(files)
      if (!files || files.length === 0) return;

      const file = files[0];
      const filePath = (file as any).path || file.name;

      if (!filePath.toLowerCase().endsWith('game.exe')) {
        message.error('请拖拽 RPG Maker 的 Game.exe 文件');
        return;
      }

      onDrop(filePath);
    };

    // 原生事件绑定
    dropArea.addEventListener('dragover', handleDragOver);
    dropArea.addEventListener('dragleave', handleDragLeave);
    dropArea.addEventListener('drop', handleDrop);

    return () => {
      dropArea.removeEventListener('dragover', handleDragOver);
      dropArea.removeEventListener('dragleave', handleDragLeave);
      dropArea.removeEventListener('drop', handleDrop);
    };
  }, [onDrop]);

  return (
    <div
      ref={dropRef}
      className="drop-zone"
      style={{
        border: '2px dashed #ccc',
        borderRadius: '8px',
        padding: '40px',
        textAlign: 'center',
        backgroundColor: dragging ? '#f0f0f0' : '#fff',
        cursor: 'pointer',
      }}
    >
      <InboxOutlined style={{ fontSize: 48, color: '#1890ff' }} />
      <p style={{ marginTop: 16 }}>请拖拽 <strong>Game.exe</strong> 到此区域</p>
    </div>
  );
};

export default FileDrop;
