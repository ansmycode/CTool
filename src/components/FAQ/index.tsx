import React, { useState } from "react";
import "./index.css";

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

interface Props {
  data: FAQItem[];
}

const FAQ: React.FC<Props> = ({ data }) => {
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(
    () => new Set(data.map((_, index) => index)),
  );

  const toggle = (index: number) => {
    setOpenIndexes((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div className="author-faq">
      {data.map((item, index) => (
        <div key={index} className="faq-item">
          <div
            className="faq-question"
            onClick={() => toggle(index)}
          >
            <span>{item.question}</span>
            <span className={`faq-arrow ${openIndexes.has(index) ? "open" : ""}`}>
              ▶
            </span>
          </div>

          {openIndexes.has(index) && (
            <div className="faq-answer">
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FAQ;
