import numpy as np
import matplotlib.pyplot as plt
import csv
import os
from datetime import datetime
class Pronostiek(object):
    def __init__(self):
        with open('Juist.csv', 'r') as infile:
            self.juist = [rij for rij in csv.reader(infile, delimiter = ';')]
        self.personen = {}
        self.bestanden = {}
        self.betaald = {}
        
        # Automatically load all player files
        spelers_dir = 'spelers'
        for filename in os.listdir(spelers_dir):
            if filename.endswith('.csv'):
                voornaam, naam = filename.split('.')[:2]
                self.nieuwe_speler(voornaam, naam, spelers_dir=spelers_dir)

    # Modify nieuwe_speler to accept spelers_dir parameter
    def nieuwe_speler(self, voornaam, naam, betaald=True, spelers_dir='spelers'):
        volledige_naam = '%s %s' % (voornaam, naam)
        self.personen[volledige_naam] = 0
        with open(os.path.join(spelers_dir, f'{voornaam}.{naam}.csv'), 'r') as infile:
            prono = [rij for rij in csv.reader(infile, delimiter=';')]
        self.bestanden[volledige_naam] = prono
        self.betaald[volledige_naam] = betaald
    
    def __str__(self):
        rankschikking = sorted(self.personen.items(), key=lambda kv: -kv[1])
        res = ''
        now = datetime.now()
        res += now.strftime("%d-%m-%Y %H:%M:%S") + '\n'
        for speler in rankschikking:
            if (self.betaald[speler[0]]):
                res += '%d. %s %.1f \n' % (rankschikking.index(speler) + 1, speler[0], speler[1])
            else:
                res += '%d. %s %.1f* \n' % (rankschikking.index(speler) + 1, speler[0], speler[1])
        return res
        
    def get_punten(self, speler):
        return self.personen[speler]
    
    def get_juiste_score(self):
        return self.juist
    
    def get_bestand(self, speler):
        return self.bestanden[speler]
    
    def totale_som(self):
        som = 0
        for speler in self.personen:
            check = self.bestanden[speler]
            for i in range(1, 7):
                for j in range(1, len(check[0])):
                    if len(check[i][j]) == 3:
                        H, A = int(check[i][j][0]), int(check[i][j][2])
                        som += H + A
        return som
                        
    
    def som_punten(self):
        som = 0
        for persoon in self.personen:
            som += self.personen[persoon]
        return som
    
    def get_tabel(self, speler):
        x = [i for i in range(1, 11)]
        y1 = self.punten(speler,1,4) + self.punten(speler,2,5) + self.punten(speler,3,6)
        y2 = self.punten(speler,6,1) + self.punten(speler,5,3) + self.punten(speler,4,2)
        y3 = self.punten(speler,1,5) + self.punten(speler,4,6) + self.punten(speler,2,3)
        y4 = self.punten(speler,3,4) + self.punten(speler,5,6) + self.punten(speler,1,2)
        y5 = self.punten(speler,3,1) + self.punten(speler,4,5) + self.punten(speler,6,2)
        y6 = self.punten(speler,6,3) + self.punten(speler,5,1) + self.punten(speler,2,4)
        y7 = self.punten(speler,1,6) + self.punten(speler,4,3) + self.punten(speler,5,2)
        y8 = self.punten(speler,3,5) + self.punten(speler,6,4) + self.punten(speler,2,1)
        y9 = self.punten(speler,4,1) + self.punten(speler,3,2) + self.punten(speler,6,5)
        y10 = self.punten(speler,1,3) + self.punten(speler,2,6) + self.punten(speler,5,4)
        y = [y1,y2,y3,y4,y5,y6,y7,y8,y9,y10]
        plt.title('Evolutie: ' + speler)
        plt.xlabel('Speeldagen')
        plt.ylabel('Punten')
        plt.bar(x,y)
        return plt.show()

    def set_punten(self):
        for speler in self.personen:
            # POI
            for i in range(1, 7):
                for j in range(1, 7):
                    self.personen[speler] += self.punten(speler, i, j)
            
            # Bekerfinale
            self.personen[speler] += self.punten(speler, 9, 1)
            
            # Extra
            for i in range(11, 18):
                if self.bestanden[speler][i][1].replace(" ","") in [x.replace(" ","") for x in self.juist[i][1].split(', ')] and self.bestanden[speler][i][1] != '':
                    self.personen[speler] += 10
            if self.bestanden[speler][18][1].replace(" ","") == self.juist[18][1].replace(" ","") and self.bestanden[speler][18][1] != '':
                self.personen[speler] += 20
        return self
    
    def punten(self, speler, i, j):
        score = 0
        check = self.bestanden[speler]
        juist = self.juist
        correct = juist[i][j].replace(" ","")
        to_check = check[i][j].replace(" ","")
        if len(correct) == 3 and len(to_check) == 3 and correct[0].isdigit() and correct[2].isdigit() and correct[1] == '-':
            HC, AC, H, A = int(correct[0]), int(correct[2]), int(to_check[0]), int(to_check[2])
            WC, GC, VC = (HC > AC), (HC == AC), (HC < AC)
            W, G, V = (H > A), (H == A), (H < A)
            if WC == W and GC == G and V == VC:
                score += 5
                if H - A == HC - AC:
                    score += 2
                    if HC == H and AC == A:
                        score += 3 + HC + AC

        return score
    
    def vergelijk(self, speler1, speler2):
        waarden = []
        x = np.array([i for i in range(1, 11)])
        for speler in [speler1, speler2]:
            y1 = self.punten(speler,1,4) + self.punten(speler,2,5) + self.punten(speler,3,6)
            y2 = self.punten(speler,6,1) + self.punten(speler,5,3) + self.punten(speler,4,2)
            y3 = self.punten(speler,1,5) + self.punten(speler,4,6) + self.punten(speler,2,3)
            y4 = self.punten(speler,3,4) + self.punten(speler,5,6) + self.punten(speler,1,2)
            y5 = self.punten(speler,3,1) + self.punten(speler,4,5) + self.punten(speler,6,2)
            y6 = self.punten(speler,6,3) + self.punten(speler,5,1) + self.punten(speler,2,4)
            y7 = self.punten(speler,1,6) + self.punten(speler,4,3) + self.punten(speler,5,2)
            y8 = self.punten(speler,3,5) + self.punten(speler,6,4) + self.punten(speler,2,1)
            y9 = self.punten(speler,4,1) + self.punten(speler,3,2) + self.punten(speler,6,5)
            y10 = self.punten(speler,1,3) + self.punten(speler,2,6) + self.punten(speler,5,4)
            y = [y1,y2,y3,y4,y5,y6,y7,y8,y9,y10]
            waarden.append(y)
        plt.title('1 vs 2')
        plt.xlabel('Speeldagen')
        plt.ylabel('Punten')
        plt.bar(x-0.2,waarden[0],label=speler1,width=0.4,color='blue')
        plt.bar(x+0.2,waarden[1],label=speler2,width=0.4,color='black')
        plt.legend()
        plt.savefig('1 vs 2')
        return plt.show()
    
    def kampioen(self):
        label = []
        size = {}
        for speler in self.personen:
            if self.bestanden[speler][13][1][-1] == ' ':
                naam = self.bestanden[speler][13][1][:-1]
            else:
                naam = self.bestanden[speler][13][1]
            if naam not in label:
                label.append(naam)
            if naam not in size:
                size[naam] = 1
            elif naam in size:
                size[naam] += 1
        labels = str(label[0]), str(label[1]), str(label[2]), str(label[3])
        sizes = list(size.values())
        colors = ['mediumblue', 'cornflowerblue', 'violet', 'lightskyblue']
        explode = (0.1, 0, 0, 0)

        plt.pie(sizes, explode=explode, labels=labels, colors=colors,
        autopct='%1.1f%%', shadow=True, startangle=140)

        plt.axis('equal')
        plt.title('Kampioen')
        plt.savefig('Kampioen')
        return plt.show()
    
    def write_to_textfile(self):
        with open('klassement.txt','w') as f:
            rankschikking = sorted(self.personen.items(), key=lambda kv: -kv[1])
            res = ''
            now = datetime.now()
            res += now.strftime("Laatst geüpdatet op: %d-%m-%Y %H:%M:%S") + '\n'
            for speler in rankschikking:
                if (self.betaald[speler[0]]):
                    res += '%d. %s %.1f \n' % (rankschikking.index(speler) + 1, speler[0], speler[1])
                else:
                    res += '%d. %s %.1f* \n' % (rankschikking.index(speler) + 1, speler[0], speler[1])
            res += "\n* nog niet betaald"
            f.write(res)
            f.close()
            
a = Pronostiek()
a.set_punten()
a.write_to_textfile()