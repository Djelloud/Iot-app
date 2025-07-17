import sys
import time
import json
import os

try:
    from gpiozero import RGBLED
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False
    print("⚠️ GPIO non disponible - mode simulation", file=sys.stderr)

def load_config():
    """Charger la configuration GPIO depuis le fichier JSON"""
    try:
        config_path = os.path.join(os.path.dirname(__file__), '../../config/team-config.json')
        with open(config_path, 'r') as f:
            config = json.load(f)
        return config.get('gpio', {
            "redPin": 18,
            "greenPin": 19,
            "bluePin": 20
        })
    except Exception as e:
        print(f"Erreur chargement config: {e}", file=sys.stderr)
        return {"redPin": 18, "greenPin": 19, "bluePin": 20}

def set_led_color(r, g, b):
    try:
        gpio_config = load_config()
        
        if GPIO_AVAILABLE:
            # Pour LED commune ANODE, utiliser active_high=False
            led = RGBLED(
                red=gpio_config['redPin'],
                green=gpio_config['greenPin'], 
                blue=gpio_config['bluePin'],
                active_high=False  # CRUCIAL pour commune anode !
            )
            
            # Maintenant les valeurs normales fonctionnent
            r_normalized = r / 255.0
            g_normalized = g / 255.0
            b_normalized = b / 255.0
            
            # Définir la couleur
            led.color = (r_normalized, g_normalized, b_normalized)
            
            print(f"LED couleur définie (anode): RGB({r}, {g}, {b})")
            
            # Garder la couleur brièvement
            time.sleep(0.1)
            
        else:
            # Mode simulation
            print(f"[SIMULATION] LED couleur: RGB({r}, {g}, {b})")
            
    except Exception as e:
        print(f"Erreur contrôle LED: {e}", file=sys.stderr)
        return False
    
    return True

def test_led():
    """Test de la LED avec différentes couleurs"""
    colors = [
        (255, 0, 0),    # Rouge
        (0, 255, 0),    # Vert
        (0, 0, 255),    # Bleu
        (255, 255, 0),  # Jaune
        (255, 0, 255),  # Magenta
        (0, 255, 255),  # Cyan
        (255, 255, 255),# Blanc
        (0, 0, 0)       # Éteint
    ]
    
    print("🧪 Test de la LED RGB...")
    for r, g, b in colors:
        print(f"🔸 Test couleur RGB({r}, {g}, {b})")
        set_led_color(r, g, b)
        time.sleep(1)
    print("Test terminé")

if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--test":
        test_led()
    elif len(sys.argv) == 4:
        try:
            r = int(sys.argv[1])
            g = int(sys.argv[2])
            b = int(sys.argv[3])
            
            if not (0 <= r <= 255 and 0 <= g <= 255 and 0 <= b <= 255):
                print("Valeurs RGB doivent être entre 0 et 255", file=sys.stderr)
                sys.exit(1)
            
            success = set_led_color(r, g, b)
            sys.exit(0 if success else 1)
            
        except ValueError:
            print("Valeurs RGB doivent être des entiers", file=sys.stderr)
            sys.exit(1)
    else:
        print("Usage:")
        print("  python3 led-control.py R G B     (définir couleur)")
        print("  python3 led-control.py --test    (test complet)")
        print("Exemple: python3 led-control.py 255 0 0  (rouge)")
        sys.exit(1)
