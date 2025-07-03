# Vamos gerar um novo arquivo script.js com a playlist ajustada para conter apenas a música de Leonardo.



# Novo conteúdo do setupDefaultPlaylists com a faixa do Leonardo

updated_script = """

// ... [início do script original omitido para focar na modificação] ...



    setupDefaultPlaylists() {

        console.log('🎵 Configurando playlists padrão...');

        

        // Substituindo por uma única faixa: Leonardo

        this.playlists.music = [

            {

                title: 'Leonardo - Não Aprendi a Dizer Adeus',

                url: 'https://res.cloudinary.com/dygbrcrr6/video/upload/v1751504859/a6i8wjf9owtqfr32haxb.mp3',

                duration: 90,

                type: 'music'

            }

        ];

        

        // Hora certa padrão

        if (this.playlists.time.length === 0) {

            this.playlists.time = [

                {

                    title: 'hora-certa-1-hora',

                    url: 'https://res.cloudinary.com/dygbrcrr6/video/upload/v1751505070/pfiyrl9uuzzsud4hxuvo.mp3',

                    duration: 6,

                    type: 'music'

                }

            ];

        }



        // Avisos padrão

        if (this.playlists.ads.length === 0) {

            this.playlists.ads = [

                {

                    title: 'aqui-voce-compra-mais-barato-',

                    url: 'https://res.cloudinary.com/dygbrcrr6/video/upload/v1751505219/jcu59rbwi8u3covg80l5.mp3',

                    duration: 3,

                    type: 'music'

                }

            ];

        }



        this.updateMusicCount();

    }

"""



# Agora vamos carregar o script original e substituir o conteúdo da função setupDefaultPlaylists

import re



# Caminho do script original carregado anteriormente

original_path = "/mnt/data/script.js"



with open(original_path, "r", encoding="utf-8") as f:

    original_code = f.read()



# Substituir a função setupDefaultPlaylists por nosso novo código

pattern = r"(setupDefaultPlaylists\s*\(\)\s*\{.*?\n\s*\})"

new_code = re.sub(pattern, updated_script.strip(), original_code, flags=re.DOTALL)



# Salvar novo arquivo com a faixa do Leonardo

output_path = "/mnt/data/script_com_leonardo.js"

with open(output_path, "w", encoding="utf-8") as f:

    f.write(new_code)



output_path
