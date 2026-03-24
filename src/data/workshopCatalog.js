const normalizeWorkshopKey = (value) =>
  (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const workshopCatalog = [
  {
    block: 1,
    matchTitle: 'Proyectos de Innovacion con Realidad Extendida (XR)',
    titleEs: 'Proyectos de Innovacion con Realidad Extendida (XR)',
    titleEn: 'Innovation Projects with Extended Reality (XR)',
    organization: 'RealiTec',
    presenters: 'Dante Crovetto',
    descriptionEs:
      'Seleccion de proyectos destacados que integran realidad virtual, aumentada y mixta. Los asistentes podran explorar como la XR esta siendo aplicada en educacion, salud, industria y emprendimiento.',
    descriptionEn:
      'A showcase of standout projects that integrate virtual, augmented, and mixed reality. Attendees will explore how XR is being applied in education, healthcare, industry, and entrepreneurship.',
  },
  {
    block: 1,
    matchTitle: 'Dinosaurios, Robots y Biomimetica',
    titleEs: 'Dinosaurios, Robots y Biomimetica',
    titleEn: 'Dinosaurs, Robots, and Biomimetics',
    organization: 'C+',
    presenters: 'Bruno Grossi',
    descriptionEs:
      'Desde la locomocion eficiente hasta estructuras resilientes, la biomimetica emerge como una herramienta clave para disenar tecnologias mas inteligentes, sostenibles y adaptativas. Una invitacion a mirar el pasado profundo de la vida en la Tierra para imaginar y construir el futuro de la ingenieria y la innovacion.',
    descriptionEn:
      'From efficient locomotion to resilient structures, biomimetics emerges as a key tool for designing smarter, more sustainable, and more adaptive technologies. This session invites participants to look at Earths deep biological past to imagine and build the future of engineering and innovation.',
  },
  {
    block: 1,
    matchTitle: 'Startups en base a dispositivos con impacto ambiental',
    titleEs: 'Startups en base a dispositivos con impacto ambiental',
    titleEn: 'Startups Built on Devices with Environmental Impact',
    organization: 'UDD Founders',
    presenters: 'Cristobal Hurtado / Matias Gatica',
    descriptionEs:
      'Explora emprendimientos basados en hardware con impacto ambiental: produccion de agua limpia de forma natural y autonoma mediante destilacion solar, y transformacion de residuos no reciclables en energia limpia a traves de un proceso de termodisociacion anoxica.',
    descriptionEn:
      'Explore hardware-based startups with environmental impact: natural and autonomous clean-water production through solar distillation, and the conversion of non-recyclable waste into clean energy through an anoxic thermodissociation process.',
  },
  {
    block: 1,
    matchTitle: 'Tecnologias de valorizacion de residuos',
    titleEs: 'Tecnologias de valorizacion de residuos',
    titleEn: 'Waste Valorization Technologies',
    organization: 'C+',
    presenters: 'Sebastian Guzman',
    descriptionEs:
      'Como transformar desechos en oportunidades mediante soluciones innovadoras y sostenibles. A partir del desarrollo de un biodigestor, se explora el potencial de convertir residuos organicos en energia y subproductos utiles, como biogas y fertilizantes, promoviendo modelos de economia circular.',
    descriptionEn:
      'How to transform waste into opportunity through innovative and sustainable solutions. Using the development of a biodigester as a case study, this workshop explores how organic waste can become energy and useful byproducts such as biogas and fertilizers, advancing circular economy models.',
  },
  {
    block: 1,
    matchTitle: 'Vocacion con impacto',
    titleEs: 'Vocacion con impacto',
    titleEn: 'Purpose with Impact',
    organization: 'Taller Educacion',
    presenters: 'Montserrat Cubillos',
    descriptionEs:
      'Taller que propone experimentar el proceso de eleccion de carrera u oficio considerando tanto las propias habilidades e intereses como las necesidades del mundo.',
    descriptionEn:
      'A workshop that invites students to experience the process of choosing a career or vocation by considering both their own abilities and interests and the needs of the world around them.',
  },
  {
    block: 1,
    matchTitle: "Juguemos 'Mision Emprende'",
    titleEs: "Juguemos 'Mision Emprende'",
    titleEn: "Let's Play 'Mission Entrepreneur'",
    organization: 'EdEm',
    presenters: 'Laura Fernandez / Vale Monenegro',
    descriptionEs:
      'Explora y comprende como, a traves del emprendimiento, es posible desarrollar habilidades clave del siglo XXI, como la resolucion de desafios, el trabajo en equipo, la empatia con los usuarios, la comunicacion efectiva de ideas y la generacion de soluciones innovadoras.',
    descriptionEn:
      'Explore how entrepreneurship can develop key 21st-century skills such as problem solving, teamwork, empathy with users, effective communication of ideas, and the creation of innovative solutions.',
  },
  {
    block: 1,
    matchTitle: 'Taller: Arma tu microscopio de bajo costo',
    titleEs: 'Taller: Arma tu microscopio de bajo costo',
    titleEn: 'Workshop: Build Your Own Low-Cost Microscope',
    organization: 'Maker Campus',
    presenters: 'Daniela Avila / Carla Paredes',
    descriptionEs:
      'Los participantes construiran su propio microscopio, con el cual podran analizar la composicion de la arena y detectar la presencia de microplasticos en nuestras playas, contribuyendo activamente a la conservacion del ecosistema.',
    descriptionEn:
      'Participants will build their own microscope and use it to analyze the composition of sand and detect microplastics on local beaches, contributing directly to ecosystem conservation.',
  },
  {
    block: 2,
    matchTitle: 'Hiri Project',
    titleEs: 'Hiri Project',
    titleEn: 'Hiri Project',
    organization: 'C+',
    presenters: 'Camilo Rodriguez',
    descriptionEs:
      'Charla del Director Ejecutivo de C+ y Director de Innovacion de la Facultad de Ingenieria. Una vision estrategica sobre como impulsar proyectos de innovacion con impacto real desde la academia, articulando tecnologia, emprendimiento y desafios del entorno.',
    descriptionEn:
      'A talk from the Executive Director of C+ and Director of Innovation of the School of Engineering. It offers a strategic vision for driving innovation projects with real-world impact from academia by connecting technology, entrepreneurship, and pressing challenges.',
  },
  {
    block: 2,
    matchTitle: 'Calidad del aire - cantidad o composicion',
    titleEs: 'Calidad del aire - cantidad o composicion',
    titleEn: 'Air Quality: Quantity or Composition?',
    organization: 'C+',
    presenters: 'Zoe Fleming',
    descriptionEs:
      'Repensar como entendemos la contaminacion atmosferica, cuestionando si basta con medir cuanto contaminante hay o si es clave entender de que esta compuesto. Desde su investigacion en Chile, la Dra. Fleming ha mostrado implicancias directas para la salud y las politicas publicas.',
    descriptionEn:
      'Rethink how we understand air pollution by asking whether it is enough to measure how much pollution exists or whether we also need to understand its composition. Drawing on research in Chile, Dr. Fleming shows the direct implications for health and public policy.',
  },
  {
    block: 2,
    matchTitle: 'Espanta Pumas en la Patagonia',
    titleEs: 'Espanta Pumas en la Patagonia',
    titleEn: 'Puma Deterrence in Patagonia',
    organization: 'C+',
    presenters: 'Javiera de la Fuente',
    descriptionEs:
      'Una solucion innovadora de coexistencia entre ganaderia y vida silvestre en uno de los ecosistemas mas desafiantes del mundo. A traves del proyecto Espanta Pumas, se explora el desarrollo de tecnologias disuasivas para proteger el ganado sin danar a los depredadores.',
    descriptionEn:
      'An innovative coexistence solution for ranching and wildlife in one of the worlds most challenging ecosystems. Through the Espanta Pumas project, this session explores deterrent technologies that protect livestock without harming predators.',
  },
  {
    block: 2,
    matchTitle: 'Charla Urbanizacion Sostenible',
    titleEs: 'Charla Urbanizacion Sostenible',
    titleEn: 'Sustainable Urbanization Talk',
    organization: 'Decano Arquitectura',
    presenters: 'Pablo Allard',
    descriptionEs:
      'Una mirada estrategica sobre como disenar y transformar ciudades frente a los desafios del siglo XXI. A partir de su experiencia en urbanismo, abordara como el cambio climatico, la densificacion urbana y las transformaciones sociales redefinen la manera en que habitamos el territorio.',
    descriptionEn:
      'A strategic perspective on how to design and transform cities in response to 21st-century challenges. Drawing on his urban planning experience, Pablo Allard will address how climate change, urban densification, and social transformation are redefining the way we inhabit territory.',
  },
  {
    block: 2,
    matchTitle: 'Visita a Instituto de Ciencias e Innovacion en Medicina (ICIM)',
    titleEs: 'Visita a Instituto de Ciencias e Innovacion en Medicina (ICIM)',
    titleEn: 'Visit to the Institute for Science and Innovation in Medicine (ICIM)',
    organization: 'ICIM',
    presenters: 'ICIM',
    descriptionEs:
      'Visita al ecosistema de investigacion de clase mundial que hace ciencia traslacional y, a traves de soluciones innovadoras, busca impactar positivamente en la salud de las personas.',
    descriptionEn:
      'A visit to a world-class research ecosystem focused on translational science that aims to improve human health through innovative solutions.',
  },
  {
    block: 2,
    matchTitle: 'Tecnologias de bajo costo en la educacion',
    titleEs: 'Tecnologias de bajo costo en la educacion',
    titleEn: 'Low-Cost Technologies in Education',
    organization: 'Maker Campus',
    presenters: 'Sebastian Perez / Vicente Lorca',
    descriptionEs:
      'La tecnologia de bajo costo ha democratizado la posibilidad de ensenar y comprender problemas complejos, transformando conceptos abstractos en experiencias tangibles y accesibles. Desde robotica sin computador hasta modelos sencillos para abordar computacion cuantica, esta sesion muestra como aprender desde la practica sin depender de infraestructura costosa.',
    descriptionEn:
      'Low-cost technology has democratized the ability to teach and understand complex problems by turning abstract concepts into tangible, accessible experiences. From computer-free robotics programming to simplified models for quantum computing, this session shows how students can learn through hands-on practice without expensive infrastructure.',
  },
  {
    block: 2,
    matchTitle: 'Perspectivas inspiradororas de las tecnologias inmersivas',
    titleEs: 'Perspectivas inspiradororas de las tecnologias inmersivas',
    titleEn: 'Inspiring Perspectives on Immersive Technologies',
    organization: 'C+',
    presenters: 'Jose Ignacio Guzman',
    descriptionEs:
      'Explora el potencial de la realidad extendida en distintos ambitos de la sociedad. A partir del desarrollo del Simulador Virtual de Cirugia Minimamente Invasiva, se vera como la realidad virtual permite entrenar habilidades complejas, generar datos, retroalimentacion y aprendizaje basado en la experiencia.',
    descriptionEn:
      'Explore the potential of extended reality across different areas of society. Building on the development of a Virtual Minimally Invasive Surgery Simulator, this session shows how virtual reality can train complex skills while generating data, feedback, and experience-based learning.',
  },
];

export const buildWorkshopId = (value) =>
  normalizeWorkshopKey(value).replace(/\s+/g, '-');

export const getBlockTimeLabel = (block) => {
  if (block === 1) {
    return '9:00 - 9:45';
  }

  if (block === 2) {
    return '10:00 - 10:45';
  }

  return 'Time TBA';
};

const workshopCatalogMap = workshopCatalog.reduce((accumulator, workshop) => {
  accumulator[normalizeWorkshopKey(workshop.matchTitle)] = workshop;
  return accumulator;
}, {});

export const getWorkshopCatalogEntry = (workshop) => {
  const idKey = normalizeWorkshopKey(workshop?.id);
  const titleKey = normalizeWorkshopKey(workshop?.title);

  return workshopCatalogMap[idKey] || workshopCatalogMap[titleKey] || null;
};
