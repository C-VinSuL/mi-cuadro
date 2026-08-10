import Card from "../../components/ui/Card/Card";
import CardTitle from "../../components/ui/Card/CardTitle";
import CardValue from "../../components/ui/Card/CardValue";

const Dashboard = () => {
  return (
    <div className="grid grid-cols-4 gap-6">

      <Card>

        <CardTitle>

            Integrantes

        </CardTitle>

        <CardValue>

            10

        </CardValue>

      </Card>

      <Card>

        <CardTitle>

            Pozo

        </CardTitle>

        <CardValue>

            $100

        </CardValue>

      </Card>

      <Card>

        <CardTitle>

            Semana

        </CardTitle>

        <CardValue>

            4 / 10

        </CardValue>

      </Card>

      <Card>

        <CardTitle>

            Tu puesto

        </CardTitle>

        <CardValue>

            #7

        </CardValue>

      </Card>

    </div>
  );
};

export default Dashboard;