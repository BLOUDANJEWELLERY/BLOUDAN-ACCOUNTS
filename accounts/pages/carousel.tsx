import { useState } from 'react';
import Head from 'next/head';

export default function HorizontalSnapCarousel() {
  const [selectedCard, setSelectedCard] = useState(1);

  const cards = [
    {
      id: 1,
      title: "Web Development",
      description: "Modern web applications with React and Next.js",
      icon: "🌐",
      color: "bg-blue-500"
    },
    {
      id: 2,
      title: "Mobile Apps",
      description: "Cross-platform mobile applications",
      icon: "📱",
      color: "bg-green-500"
    },
    {
      id: 3,
      title: "UI/UX Design",
      description: "Beautiful and intuitive user interfaces",
      icon: "🎨",
      color: "bg-purple-500"
    },
    {
      id: 4,
      title: "Cloud Services",
      description: "Scalable cloud infrastructure",
      icon: "☁️",
      color: "bg-orange-500"
    },
    {
      id: 5,
      title: "Data Analytics",
      description: "Insights from your business data",
      icon: "📊",
      color: "bg-red-500"
    },
    {
      id: 6,
      title: "AI & ML",
      description: "Intelligent solutions powered by AI",
      icon: "🤖",
      color: "bg-indigo-500"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <Head>
        <title>Horizontal Snap Carousel</title>
        <meta name="description" content="Next.js Horizontal Snap Carousel Demo" />
      </Head>

      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center text-gray-800 mb-4">
          Our Services
        </h1>
        <p className="text-lg text-center text-gray-600 mb-12">
          Scroll horizontally to explore our services
        </p>

        {/* Horizontal Snap Carousel */}
        <div className="relative">
          <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide space-x-6 pb-8 px-4">
            {cards.map((card) => (
              <div
                key={card.id}
                className={`
                  flex-shrink-0 w-80 h-96 rounded-2xl p-8 transition-all duration-300 ease-in-out
                  snap-center cursor-pointer transform hover:scale-105
                  ${selectedCard === card.id ? 'ring-4 ring-blue-400 shadow-2xl' : 'shadow-lg'}
                  ${card.color} text-white
                `}
                onClick={() => setSelectedCard(card.id)}
              >
                <div className="flex flex-col h-full justify-between">
                  <div className="text-6xl mb-6">{card.icon}</div>
                  
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold mb-4">{card.title}</h3>
                    <p className="text-lg opacity-90">{card.description}</p>
                  </div>

                  <div className="mt-6">
                    <button className="bg-white text-gray-800 px-6 py-3 rounded-full font-semibold hover:bg-gray-100 transition-colors">
                      Learn More
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Scroll hint */}
          <div className="flex justify-center mt-8">
            <div className="flex space-x-2">
              {cards.map((card) => (
                <button
                  key={card.id}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    selectedCard === card.id ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                  onClick={() => {
                    setSelectedCard(card.id);
                    // Scroll to the selected card
                    const element = document.getElementById(`card-${card.id}`);
                    element?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Selected Card Info */}
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Selected: {cards.find(card => card.id === selectedCard)?.title}
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            {cards.find(card => card.id === selectedCard)?.description}
          </p>
        </div>
      </div>
    </div>
  );
}