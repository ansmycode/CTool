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
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
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
            <span className={`faq-arrow ${openIndex === index ? "open" : ""}`}>
              ▶
            </span>
          </div>

          {openIndex === index && (
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
